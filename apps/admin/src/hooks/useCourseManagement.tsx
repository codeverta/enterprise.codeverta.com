import React, { useEffect, useState } from "react";
import { useParams, useNavigate, useSearchParams } from "react-router";


export function useCourseManagement(user, dependencies = {}) {
  const { id: courseId } = useParams();
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();

  const {
    api,
    toast,
    getResponseData,
    emptyModuleForm,
    emptyLessonForm,
    emptyAssetForm,
  } = dependencies;

  const [course, setCourse] = useState(null);
  const [loadingCourse, setLoadingCourse] = useState(true);
  const [accessDenied, setAccessDenied] = useState(false);

  // Hierarchy States
  const [modules, setModules] = useState([]);
  const [lessonsByModule, setLessonsByModule] = useState({});
  const [quizzesByModule, setQuizzesByModule] = useState({});
  const [assetsByLesson, setAssetsByLesson] = useState({});

  // Navigation & Selection Context
  const [activeType, setActiveType] = useState(() => {
    const editor = searchParams.get("editor");
    const type = searchParams.get("type");
    if (editor) return editor;
    if (type) return type;
    return "module";
  });
  const [selectedModuleId, setSelectedModuleId] = useState("");
  const [selectedLessonId, setSelectedLessonId] = useState("");

  // Form States
  const [moduleForm, setModuleForm] = useState(emptyModuleForm);
  const [lessonForm, setLessonForm] = useState(emptyLessonForm);
  const [initialModuleForm, setInitialModuleForm] = useState(emptyModuleForm);
  const [initialLessonForm, setInitialLessonForm] = useState(emptyLessonForm);

  const role = Number(user?.role || 0);
  const defaultAssetForm = () => ({
    ...emptyAssetForm,
    type: role === 30 ? "youtube" : "video",
  });
  const [assetForm, setAssetForm] = useState(defaultAssetForm);

  const [busyKey, setBusyKey] = useState("");

  // Unsaved Changes Tracking
  const isModuleDirty =
    activeType === "module" &&
    (moduleForm.title !== initialModuleForm.title ||
      (moduleForm.description || "") !== (initialModuleForm.description || "") ||
      !!moduleForm.is_published !== !!initialModuleForm.is_published);

  const isLessonDirty =
    (activeType === "lesson" || activeType === "quiz-create") &&
    (lessonForm.title !== initialLessonForm.title ||
      (lessonForm.summary || "") !== (initialLessonForm.summary || "") ||
      !!lessonForm.is_preview !== !!initialLessonForm.is_preview ||
      !!lessonForm.is_published !== !!initialLessonForm.is_published ||
      assetForm.title.trim() !== "" ||
      assetForm.file_url.trim() !== "");

  const isDirty = isModuleDirty || isLessonDirty;

  const [showUnsavedDialog, setShowUnsavedDialog] = useState(false);
  const [pendingAction, setPendingAction] = useState<(() => void) | null>(null);

  const requestNavigation = (action: () => void) => {
    if (isDirty) {
      setPendingAction(() => action);
      setShowUnsavedDialog(true);
    } else {
      action();
    }
  };

  const handleConfirmUnsavedNavigation = () => {
    setShowUnsavedDialog(false);
    setInitialModuleForm(moduleForm);
    setInitialLessonForm(lessonForm);
    setAssetForm(defaultAssetForm());
    if (pendingAction) {
      pendingAction();
      setPendingAction(null);
    }
  };

  const handleCancelUnsavedNavigation = () => {
    setShowUnsavedDialog(false);
    setPendingAction(null);
  };

  useEffect(() => {
    const handleBeforeUnload = (e: BeforeUnloadEvent) => {
      if (isDirty) {
        e.preventDefault();
        e.returnValue = "";
      }
    };
    window.addEventListener("beforeunload", handleBeforeUnload);
    return () => window.removeEventListener("beforeunload", handleBeforeUnload);
  }, [isDirty]);

  const isViewMode =
    searchParams.get("view") === "true" || searchParams.get("mode") === "view";
  const isActualMentor = role === 30 && course?.mentors?.some((m: any) => m.id === user?.id);
  const canManageCourses = role >= 99 || isActualMentor;
  const canManageAssets = canManageCourses;
  const canOpenCourseEditor = canManageAssets;

  useEffect(() => {
    if (courseId) {
      fetchCourseDetail();
      loadModules(courseId);
    }
  }, [courseId]);

  const fetchCourseDetail = async () => {
    try {
      const res = await api.get(`/lms/courses/${courseId}`);
      setCourse(res.data?.data || res.data);
      setAccessDenied(false);
    } catch (err) {
      if (err.response?.status === 403) {
        toast.error(JSON.stringify(err.response?.data?.message || "Akses ditolak"));
        setAccessDenied(true);
        return;
      }
      toast.error("Gagal memuat detail kursus");
    } finally {
      setLoadingCourse(false);
    }
  };

  const loadModules = async (cId) => {
    if (!cId) return;
    setBusyKey(`modules-${cId}`);
    try {
      const res = await api.get(`/lms/courses/${cId}/tree`);
      const treeData = getResponseData(res);
      const rawMods = Array.isArray(treeData?.modules) ? treeData.modules : Array.isArray(treeData) ? treeData : [];
      const mods = rawMods.sort(
        (a, b) => (a.sort_order || 0) - (b.sort_order || 0)
      );
      setModules(mods);

      if (mods.length > 0) {
        const nextLessonsByModule = {};
        const nextQuizzesByModule = {};

        mods.forEach((m) => {
          const lessons = (m.lessons || []).sort(
            (a, b) => (a.sort_order || 0) - (b.sort_order || 0)
          );
          const quizzes = (m.quizzes || [])
            .map((item) => {
              const quiz = item.quiz || item;
              return item.quiz ? { ...quiz, progress: item.progress } : quiz;
            })
            .sort((a, b) => (a.sort_order || 0) - (b.sort_order || 0));

          nextLessonsByModule[m.id] = lessons;
          nextQuizzesByModule[m.id] = quizzes;
        });

        setLessonsByModule(nextLessonsByModule);
        setQuizzesByModule(nextQuizzesByModule);

        // Restore selection from URL
        const paramType = searchParams.get("type");
        const paramEditor = searchParams.get("editor");
        const paramModId = searchParams.get("moduleId");
        const paramLesId = searchParams.get("lessonId");
        const paramQuizId = searchParams.get("quizId");

        if (paramType === "lesson" && paramLesId) {
          let foundLes = null;
          Object.values(nextLessonsByModule).forEach((lesList: any) => {
            const l = lesList.find((item: any) => item.id === paramLesId);
            if (l) foundLes = l;
          });
          if (foundLes) {
            handleSelectLessonRaw(foundLes);
          } else {
            handleSelectModuleRaw(mods[0]);
          }
        } else if (paramType === "quiz" && paramQuizId) {
          let foundQuiz = null;
          Object.values(nextQuizzesByModule).forEach((qList: any) => {
            const q = qList.find((item: any) => item.id === paramQuizId);
            if (q) foundQuiz = q;
          });
          if (foundQuiz) {
            handleSelectQuizRaw(foundQuiz);
          } else {
            handleSelectModuleRaw(mods[0]);
          }
        } else if (paramType === "module" && paramModId) {
          const foundMod = mods.find((m) => m.id === paramModId);
          if (foundMod) {
            handleSelectModuleRaw(foundMod);
          } else {
            handleSelectModuleRaw(mods[0]);
          }
        } else if (paramType === "lesson-create" && paramModId) {
          handleCreateNewLessonRaw(paramModId);
        } else if (paramType === "quiz-create" && paramModId) {
          handleCreateNewQuizRaw(paramModId, paramLesId || "");
        } else if (paramEditor === "certificate" || paramEditor === "students" || paramEditor === "assignments") {
          setActiveType(paramEditor);
        } else {
          handleSelectModuleRaw(mods[0]);
        }
      } else {
        setLessonsByModule({});
        setQuizzesByModule({});
      }
    } catch (err) {
      if (err.response?.status === 403) {
        setAccessDenied(true);
        return;
      }
      toast.error("Gagal memuat unit kursus");
    } finally {
      setBusyKey("");
    }
  };

  const loadQuizzes = async (moduleId) => {
    try {
      const qr = await api.get("/lms/quizzes", {
        params: { module_id: moduleId, limit: 100 },
      });
      const quizzes = getResponseData(qr)
        .map((item) => {
          const quiz = item.quiz || item;
          return item.quiz ? { ...quiz, progress: item.progress } : quiz;
        })
        .sort((a, b) => (a.sort_order || 0) - (b.sort_order || 0));
      setQuizzesByModule((prev) => ({ ...prev, [moduleId]: quizzes }));
    } catch {
      setQuizzesByModule((prev) => ({ ...prev, [moduleId]: [] }));
    }
  };

  const loadLessons = async (moduleId) => {
    try {
      const lr = await api.get("/lms/lessons", {
        params: { module_id: moduleId, limit: 100 },
      });
      const lessons = getResponseData(lr).sort(
        (a, b) => (a.sort_order || 0) - (b.sort_order || 0)
      );
      setLessonsByModule((prev) => ({ ...prev, [moduleId]: lessons }));
    } catch {
      toast.error("Gagal memuat list lesson");
    }
  };

  const loadAssets = async (lessonId) => {
    try {
      const ar = await api.get("/lms/learning-assets", {
        params: { lesson_id: lessonId, limit: 100 },
      });
      setAssetsByLesson((prev) => ({
        ...prev,
        [lessonId]: getResponseData(ar),
      }));
    } catch {
      toast.error("Gagal memuat media pendukung");
    }
  };

  const handleOnDragEnd = async (result) => {
    if (!result.destination || !canManageCourses) return;

    const items = Array.from(modules);
    const [reorderedItem] = items.splice(result.source.index, 1);
    items.splice(result.destination.index, 0, reorderedItem);

    const updatedItems = items.map((item, index) => ({
      ...item,
      sort_order: index,
    }));
    setModules(updatedItems);

    try {
      await api.put(`/lms/admin/modules/reorder`, {
        course_id: courseId,
        modules: updatedItems.map((m) => ({
          id: m.id,
          sort_order: m.sort_order,
        })),
      });
      toast.success("Urutan unit berhasil diperbarui");
    } catch {
      toast.error("Gagal menyimpan urutan unit");
      loadModules(courseId);
    }
  };

  const handleSelectModuleRaw = (mod: any) => {
    setSelectedModuleId(mod.id);
    setSelectedLessonId("");
    setActiveType("module");
    setModuleForm(mod);
    setInitialModuleForm(mod);
    setSearchParams((prev) => {
      const next = new URLSearchParams(prev);
      next.set("type", "module");
      next.set("moduleId", mod.id);
      next.delete("lessonId");
      next.delete("quizId");
      next.delete("editor");
      return next;
    });
  };

  const handleSelectLessonRaw = async (lesson: any) => {
    setSelectedModuleId(lesson.module_id);
    setSelectedLessonId(lesson.id);
    setActiveType("lesson");
    setLessonForm(lesson);
    setInitialLessonForm(lesson);
    setAssetForm(defaultAssetForm());
    setSearchParams((prev) => {
      const next = new URLSearchParams(prev);
      next.set("type", "lesson");
      next.set("moduleId", lesson.module_id);
      next.set("lessonId", lesson.id);
      next.delete("quizId");
      next.delete("editor");
      return next;
    });
    await loadAssets(lesson.id);
  };

  const handleSelectQuizRaw = (quiz: any) => {
    setSelectedModuleId(quiz.module_id);
    setSelectedLessonId(quiz.id);
    setActiveType("quiz");
    setLessonForm(quiz);
    setInitialLessonForm(quiz);
    setSearchParams((prev) => {
      const next = new URLSearchParams(prev);
      next.set("type", "quiz");
      next.set("moduleId", quiz.module_id);
      next.set("quizId", quiz.id);
      next.delete("lessonId");
      next.delete("editor");
      return next;
    });
  };

  const handleCreateNewLessonRaw = (moduleId: string) => {
    setSelectedModuleId(moduleId);
    setSelectedLessonId("");
    setActiveType("lesson");
    const newLes = { ...emptyLessonForm, module_id: moduleId };
    setLessonForm(newLes);
    setInitialLessonForm(newLes);
    setAssetForm(defaultAssetForm());
    setAssetsByLesson((prev) => ({ ...prev, [""]: [] }));
    setSearchParams((prev) => {
      const next = new URLSearchParams(prev);
      next.set("type", "lesson-create");
      next.set("moduleId", moduleId);
      next.delete("lessonId");
      next.delete("quizId");
      next.delete("editor");
      return next;
    });
  };

  const handleCreateNewQuizRaw = (moduleId: string, lessonId = "") => {
    setSelectedModuleId(moduleId);
    setSelectedLessonId("");
    setActiveType("quiz-create");
    const newQuiz = { title: "", module_id: moduleId, lesson_id: lessonId, id: "" };
    setLessonForm(newQuiz);
    setInitialLessonForm(newQuiz);
    setSearchParams((prev) => {
      const next = new URLSearchParams(prev);
      next.set("type", "quiz-create");
      next.set("moduleId", moduleId);
      if (lessonId) next.set("lessonId", lessonId);
      else next.delete("lessonId");
      next.delete("quizId");
      next.delete("editor");
      return next;
    });
  };

  const handleSelectTabRaw = (tab: ActiveType) => {
    setActiveType(tab);
    setSearchParams((prev) => {
      const next = new URLSearchParams(prev);
      if (tab) next.set("editor", tab);
      else next.delete("editor");
      next.delete("type");
      next.delete("moduleId");
      next.delete("lessonId");
      next.delete("quizId");
      return next;
    });
  };

  const handleSelectModule = (mod: any) => requestNavigation(() => handleSelectModuleRaw(mod));
  const handleSelectLesson = (les: any) => requestNavigation(() => handleSelectLessonRaw(les));
  const handleSelectQuiz = (quiz: any) => requestNavigation(() => handleSelectQuizRaw(quiz));
  const handleCreateNewLesson = (modId: string) => requestNavigation(() => handleCreateNewLessonRaw(modId));
  const handleCreateNewQuiz = (modId: string, lesId?: string) => requestNavigation(() => handleCreateNewQuizRaw(modId, lesId));
  const safeSetActiveType = (tab: ActiveType) => requestNavigation(() => handleSelectTabRaw(tab));

  const saveModule = async () => {
    if (!moduleForm.title.trim())
      return toast.error("Judul unit wajib diisi");
    setBusyKey("save-module");
    try {
      const payload = {
        course_id: courseId,
        title: moduleForm.title,
        description: moduleForm.description,
        sort_order: Number(moduleForm.sort_order || 0),
        is_published: !!moduleForm.is_published,
      };
      if (moduleForm.id) {
        await api.put(`/subscriptions/admin/resources/modules/${moduleForm.id}`, payload);
        toast.success("Unit diperbarui");
      } else {
        await api.post("/lms/admin/modules", payload);
        toast.success("Unit ditambahkan");
        setModuleForm(emptyModuleForm);
      }
      setInitialModuleForm(moduleForm);
      await loadModules(courseId);
    } catch (err) {
      toast.error(err.response?.data?.message || "Gagal menyimpan unit");
    } finally {
      setBusyKey("");
    }
  };

  const saveLesson = async () => {
    if (!lessonForm.title.trim()) return toast.error("Judul lesson wajib diisi");
    setBusyKey("save-lesson");
    try {
      const payload = {
        module_id: selectedModuleId,
        title: lessonForm.title,
        summary: lessonForm.summary || "",
        sort_order: Number(lessonForm.sort_order || 0),
        duration_sec: 0,
        is_preview: !!lessonForm.is_preview,
        is_published: !!lessonForm.is_published,
        require_attachment: !!lessonForm.require_attachment,
        attachment_passing_score: Number(lessonForm.attachment_passing_score || 0),
      };

      let savedLessonId = lessonForm.id;
      let freshLesson = null;

      if (lessonForm.id) {
        const res = await api.put(
          `/subscriptions/admin/resources/lessons/${lessonForm.id}`,
          payload
        );
        freshLesson = res.data?.data || res.data;
      } else {
        const res = await api.post("/lms/admin/lessons", payload);
        savedLessonId = res.data?.data?.id || res.data?.id;
        freshLesson = res.data?.data || res.data;
      }

      // 🔥 Auto-attach asset kalau form asset sudah terisi — 1 step, gak perlu klik kedua
      const hasPendingAsset = assetForm.title.trim() && assetForm.file_url.trim();
      if (hasPendingAsset) {
        const isYouTube = assetForm.type === "youtube";
        const assetPayload = {
          lesson_id: savedLessonId,
          title: assetForm.title,
          description: assetForm.description,
          sort_order: (assetsByLesson[savedLessonId]?.length || 0) + 1,
        };
        if (isYouTube) {
          await api.post("/lms/learning-assets/youtube", {
            ...assetPayload,
            youtube_url: assetForm.file_url,
          });
        } else {
          await api.post("/lms/admin/learning-assets", {
            ...assetPayload,
            type: assetForm.type,
            file_url: assetForm.file_url,
            thumbnail_url: assetForm.thumbnail_url,
            is_downloadable: !!assetForm.is_downloadable,
          });
        }
        setAssetForm(defaultAssetForm());
        await loadAssets(savedLessonId);
      }

      toast.success(
        hasPendingAsset
          ? "Lesson & media berhasil disimpan"
          : lessonForm.id
          ? "Lesson disimpan"
          : "Lesson baru dibuat"
      );
      await loadLessons(selectedModuleId);

      if (freshLesson?.id) {
        const finalLessonData = freshLesson.title
          ? freshLesson
          : { ...lessonForm, id: savedLessonId, ...payload };
        setInitialLessonForm(finalLessonData);
        setAssetForm(defaultAssetForm());
        handleSelectLessonRaw(finalLessonData);
      }
    } catch (err) {
      toast.error(err.response?.data?.message || "Gagal menyimpan lesson");
    } finally {
      setBusyKey("");
    }
  };

  const deleteModule = async (moduleId) => {
    if (!confirm("Hapus unit ini beserta seluruh lesson di dalamnya?"))
      return;
    try {
      await api.delete(`/subscriptions/admin/resources/modules/${moduleId}`);
      toast.success("Unit dihapus");
      setModuleForm(emptyModuleForm);
      setActiveType("module");
      await loadModules(courseId);
    } catch {
      toast.error("Gagal menghapus unit");
    }
  };

  const deleteLesson = async (moduleId, lessonId) => {
    if (!confirm("Hapus lesson ini?")) return;
    try {
      await api.delete(`/subscriptions/admin/resources/lessons/${lessonId}`);
      toast.success("Lesson dihapus");
      setLessonForm(emptyLessonForm);
      setActiveType("module");
      await loadLessons(moduleId);
    } catch {
      toast.error("Gagal menghapus lesson");
    }
  };

  const addAsset = async () => {
    if (!selectedLessonId)
      return toast.error(
        "Simpan lesson terlebih dahulu sebelum menambah media"
      );
    if (!assetForm.title.trim() || !assetForm.file_url.trim())
      return toast.error("Judul dan file asset wajib diisi");

    const isYouTube = assetForm.type === "youtube";
    setBusyKey("save-asset");
    try {
      const payload = {
        lesson_id: selectedLessonId,
        title: assetForm.title,
        description: assetForm.description,
        sort_order: (assetsByLesson[selectedLessonId]?.length || 0) + 1,
      };
      if (isYouTube) {
        await api.post("/lms/learning-assets/youtube", {
          ...payload,
          youtube_url: assetForm.file_url,
        });
      } else {
        await api.post("/lms/admin/learning-assets", {
          ...payload,
          type: assetForm.type,
          file_url: assetForm.file_url,
          thumbnail_url: assetForm.thumbnail_url,
          is_downloadable: !!assetForm.is_downloadable,
        });
      }
      toast.success("Media ditambahkan");
      setAssetForm(defaultAssetForm());
      await loadAssets(selectedLessonId);
    } catch {
      toast.error("Gagal menambahkan media");
    } finally {
      setBusyKey("");
    }
  };

  const deleteAsset = async (assetId) => {
    if (!confirm("Hapus media ini?")) return;
    try {
      await api.delete(`/lms/learning-assets/${assetId}`);
      toast.success("Media dihapus");
      await loadAssets(selectedLessonId);
    } catch {
      toast.error("Gagal menghapus media");
    }
  };

  const uploadAssetFile = async (file) => {
    if (!file) return;

    // Size limit check
    let maxSize = 20 * 1024 * 1024; // default 20MB
    if (assetForm.type === "video" || assetForm.type === "audiobook") {
      maxSize = 100 * 1024 * 1024; // 100MB
    } else if (assetForm.type === "image") {
      maxSize = 5 * 1024 * 1024; // 5MB
    }

    if (file.size > maxSize) {
      const sizeStr = maxSize >= 1024 * 1024 ? `${maxSize / (1024 * 1024)}MB` : `${maxSize / 1024}KB`;
      toast.error(`Ukuran file terlalu besar. Maksimal adalah ${sizeStr}.`);
      return;
    }

    const toastId = toast.loading("Mengupload file ke cloud storage...");
    try {
      const data = new FormData();
      data.append("file", file);
      data.append("type", assetForm.type);
      const res = await api.post("/admin/upload-media", data, {
        headers: { "Content-Type": "multipart/form-data" },
      });
      const url = res.data?.data?.url || "";
      setAssetForm((prev) => ({
        ...prev,
        title: prev.title || file.name.replace(/\.[^.]+$/, ""),
        file_url: url,
      }));
      toast.success("File berhasil diupload", { id: toastId });
    } catch {
      toast.error("Gagal upload file", { id: toastId });
    }
  };

  const uploadAssetThumbnail = async (file) => {
    if (!file) return;

    if (file.size > 5 * 1024 * 1024) { // 5MB limit
      toast.error("Ukuran file thumbnail terlalu besar. Maksimal adalah 5MB.");
      return;
    }

    const toastId = toast.loading("Mengupload thumbnail...");
    try {
      const data = new FormData();
      data.append("file", file);
      const res = await api.post("/admin/upload-image", data, {
        headers: { "Content-Type": "multipart/form-data" },
      });
      setAssetForm((prev) => ({
        ...prev,
        thumbnail_url: res.data?.data?.url || "",
      }));
      toast.success("Thumbnail disimpan", { id: toastId });
    } catch {
      toast.error("Gagal upload thumbnail", { id: toastId });
    }
  };

  const insertMarkdown = (tag) => {
    const current = lessonForm.summary || "";
    setLessonForm((prev) => ({
      ...prev,
      summary: `${current}${current ? "\n" : ""}${tag}`,
    }));
  };

  const startLearning = async () => {
    const firstModule = modules[0];
    const firstLesson = firstModule
      ? (lessonsByModule[firstModule.id] || [])[0]
      : null;
    if (firstLesson) {
      if (canManageCourses) {
        await handleSelectLesson(firstLesson);
      } else {
        navigate(`/dashboard/lessons/${firstLesson.id}`);
      }
    }
  };

  return {
    courseId,
    navigate,
    course,
    loadingCourse,
    accessDenied,
    modules,
    lessonsByModule,
    quizzesByModule,
    assetsByLesson,
    activeType,
    selectedModuleId,
    selectedLessonId,
    moduleForm,
    setModuleForm,
    lessonForm,
    setLessonForm,
    assetForm,
    setAssetForm,
    busyKey,
    isViewMode,
    canManageCourses,
    canManageAssets,
    canOpenCourseEditor,
    handleOnDragEnd,
    handleSelectModule,
    handleSelectLesson,
    handleCreateNewLesson,
    saveModule,
    saveLesson,
    deleteModule,
    deleteLesson,
    addAsset,
    deleteAsset,
    uploadAssetFile,
    uploadAssetThumbnail,
    insertMarkdown,
    startLearning,
    loadModules,
    handleCreateNewQuiz,
    handleSelectQuiz,
    setActiveType: safeSetActiveType,
    fetchCourseDetail,
    isDirty,
    showUnsavedDialog,
    handleConfirmUnsavedNavigation,
    handleCancelUnsavedNavigation,
  };
}

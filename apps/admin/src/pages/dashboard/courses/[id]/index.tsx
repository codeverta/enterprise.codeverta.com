import React, { useState, useRef, useCallback, useEffect } from "react";
import { useSearchParams } from "react-router";
import {
  Bold,
  FileAudio,
  FileImage,
  FileText,
  Heading1,
  Heading2,
  Heading3,
  Italic,
  Link,
  List,
  ListOrdered,
  Loader2,
  LockKeyhole,
  ArrowLeft,
  Video,
  Plus,
  Code,
  Code2,
  Quote,
  Strikethrough,
  Table,
  CheckSquare,
  Sigma,
  Image,
  Minus,
  Sparkles,
  AlertTriangle,
} from "lucide-react";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { useCourseManagement } from "@/hooks/useCourseManagement";
import api from "@/lib/api";
import { toast } from "sonner";
import DashboardLayout from "@/layout/DashboardLayout";
import { Button } from "@/components/ui/button";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";
import CourseViewer from "@/components/course/CourseViewer";
import katex from "katex";
import "katex/dist/katex.min.css";

// Import Komponen Hasil Split
import { CourseHeader } from "@/components/course-editor/CourseHeader";
import { CourseSidebar } from "@/components/course-editor/CourseSidebar";
import { ModuleEditor } from "@/components/course-editor/ModuleEditor";
import { QuizEditor, QuizManageView } from "@/components/course-editor/QuizEditor";
import { LessonEditor } from "@/components/course-editor/LessonEditor";
import ModuleItem from "@/components/course-editor/ModuleItem"; 
import CertificateTemplateEditor from "@/components/course-editor/CertificateTemplateEditor";
import CourseFormDialog from "@/components/course-list/CourseFormDialog";
import CourseStudentsView from "@/components/course-editor/CourseStudentsView";
import { markdownPreview } from "@/lib/utils";

const emptyModuleForm = {
  id: "",
  title: "",
  description: "",
  sort_order: 0,
  is_published: true,
};
const emptyLessonForm = {
  id: "",
  module_id: "",
  title: "",
  summary: "",
  is_preview: false,
  is_published: true,
  require_attachment: false,
  attachment_passing_score: 0,
};
const emptyAssetForm = {
  title: "",
  type: "video",
  file_url: "",
  thumbnail_url: "",
  description: "",
  is_downloadable: false,
};

const assetTypes = [
  { value: "video", label: "Video", icon: Video },
  { value: "youtube", label: "YouTube URL", icon: Video },
  { value: "audiobook", label: "Audiobook", icon: FileAudio },
  { value: "image", label: "Gambar", icon: FileImage },
  { value: "ebook", label: "Ebook", icon: FileText },
  { value: "worksheet", label: "Worksheet", icon: FileText },
];

const acceptByAssetType = {
  video: "video/mp4,video/webm,video/quicktime,video/x-m4v",
  audiobook: "audio/*,.m4a,.mp3,.wav,.ogg,.flac",
  image: "image/*",
  ebook: ".pdf,.epub,.doc,.docx,application/pdf,application/epub+zip",
  worksheet: ".pdf,.doc,.docx,.xls,.xlsx,.csv,.zip",
};

const getResponseData = (r) => r.data?.data || r.data || [];



const ToolbarBtn = ({ icon: Icon, label, onClick, active, kbd }) => (
  <TooltipProvider delayDuration={300}>
    <Tooltip>
      <TooltipTrigger asChild>
        <button
          type="button"
          onClick={onClick}
          className={cn(
            "inline-flex items-center justify-center h-7 w-7 rounded-md text-zinc-500 transition-all hover:bg-zinc-100 hover:text-zinc-900 active:scale-95",
            active && "bg-indigo-100 text-indigo-700"
          )}
        >
          <Icon className="h-3.5 w-3.5" />
        </button>
      </TooltipTrigger>
      <TooltipContent side="bottom" className="text-xs">
        {label}
        {kbd && (
          <kbd className="ml-1.5 font-mono bg-zinc-700 text-zinc-200 px-1 rounded text-[10px]">
            {kbd}
          </kbd>
        )}
      </TooltipContent>
    </Tooltip>
  </TooltipProvider>
);

const RichToolbar = ({ onInsert }) => {
  const fileInputRef = useRef(null);

  const handleImageUpload = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (!file.type.startsWith("image/")) {
      toast.error("File harus berupa gambar");
      return;
    }
    try {
      const formData = new FormData();
      formData.append("file", file);
      const res = await api.post("/admin/upload-image", formData, {
        headers: { "Content-Type": "multipart/form-data" },
      });
      const payload = res.data?.data || res.data || {};
      const url = payload?.url || payload?.file_url || payload?.path;
      if (!url) throw new Error("URL tidak ditemukan dari response upload");
      onInsert(`![${file.name}](${url})`, "insert");
      toast.success("Gambar berhasil diunggah");
    } catch (err) {
      toast.error(err.response?.data?.message || err.message || "Gagal mengunggah gambar");
    }
    e.target.value = "";
  };

  const btnStyle = "flex items-center justify-center h-7 w-7 rounded text-zinc-600 hover:bg-zinc-200 transition-colors";

  return (<>
  <input ref={fileInputRef} type="file" accept="image/*" className="hidden" onChange={handleImageUpload} />
  <div className="flex flex-wrap items-center gap-0.5 px-3 py-2 border-b bg-zinc-50/80">
    {[
      [
        { icon: Heading1, label: "Heading 1", insert: "# ", type: "prefix" },
        { icon: Heading2, label: "Heading 2", insert: "## ", type: "prefix" },
        { icon: Heading3, label: "Heading 3", insert: "### ", type: "prefix" },
      ],
      [
        { icon: Bold, label: "Bold", insert: "**", kbd: "⌘B" },
        { icon: Italic, label: "Italic", insert: "*", kbd: "⌘I" },
        { icon: Strikethrough, label: "Strikethrough", insert: "~~" },
        { icon: Code, label: "Inline Code", insert: "`" },
      ],
      [
        { icon: List, label: "Bullet List", insert: "- ", type: "prefix" },
        { icon: ListOrdered, label: "Numbered List", insert: "1. ", type: "prefix" },
        { icon: CheckSquare, label: "Task List", insert: "- [ ] ", type: "prefix" },
        { icon: Quote, label: "Blockquote", insert: "> ", type: "prefix" },
      ],
      [
        {
          icon: Code2,
          label: "Code Block",
          insert: "```js\n// kode di sini\n```",
          type: "insert",
        },
        { icon: Sigma, label: "Math Inline", insert: "$E = mc^2$" },
        {
          icon: Sigma,
          label: "Math Block",
          insert: "$$\n\\sum_{i=1}^{n} x_i\n$$",
          type: "insert",
        },
        {
          icon: Table,
          label: "Table",
          insert:
            "| Kolom 1 | Kolom 2 |\n|---------|----------|\n| Data 1  | Data 2  |",
          type: "insert",
        },
      ],
      [
        { icon: Link, label: "Link", insert: "[teks link](https://)", type: "insert" },
        {
          icon: Image,
          label: "Image",
          insert: null,
          isUpload: true,
        },
        { icon: Minus, label: "Divider", insert: "\n---\n", type: "insert" },
      ],
    ].map((group, gi) => (
      <React.Fragment key={gi}>
        {gi > 0 && <div className="w-px h-5 bg-zinc-200 mx-0.5" />}
        {group.map((btn, bi) => (
          <ToolbarBtn
            key={bi}
            icon={btn.icon}
            label={btn.label}
            kbd={btn.kbd}
            onClick={
              btn.isUpload
                ? () => fileInputRef.current?.click()
                : () => onInsert(btn.insert, btn.type)
            }
          />
        ))}
      </React.Fragment>
    ))}
  </div>
  </>);
};
function CourseContentManagementPage({ user, setIsSidebarOpen }) {
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [expandedModules, setExpandedModules] = useState({});
  const textareaRef = useRef(null);
  const [searchParams, setSearchParams] = useSearchParams();

  const {
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
    startLearning,
    loadModules,
    handleCreateNewQuiz,
    handleSelectQuiz,
    setActiveType,
    fetchCourseDetail,
    isDirty,
    showUnsavedDialog,
    handleConfirmUnsavedNavigation,
    handleCancelUnsavedNavigation,
  } = useCourseManagement(user, {
    api,
    toast,
    getResponseData,
    emptyModuleForm,
    emptyLessonForm,
    emptyAssetForm,
  });

  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [categories, setCategories] = useState([]);

  useEffect(() => {
    const fetchCategories = async () => {
      try {
        const res = await api.get("/lms/course-categories", {
          params: { limit: 100 },
        });
        setCategories(res.data?.data || res.data || []);
      } catch (err) {
        console.error("Failed to fetch categories:", err);
      }
    };
    fetchCategories();
  }, []);

    useEffect(() => {
      setIsSidebarOpen(false);
    }, []);


  useEffect(() => {
    document.querySelectorAll(".math-block").forEach((el) => {
      const formula = decodeURIComponent(el.getAttribute("data-math"));
      katex.render(formula, el, { displayMode: true, throwOnError: false });
    });
    document.querySelectorAll(".math-inline").forEach((el) => {
      const formula = decodeURIComponent(el.getAttribute("data-math"));
      katex.render(formula, el, { displayMode: false, throwOnError: false });
    });
  }, [lessonForm.summary]);

  const toggleModule = useCallback((modId) => {
    setExpandedModules((prev) => ({ ...prev, [modId]: !prev[modId] }));
  }, []);

  // Listen for certificate tab activation from sidebar
  useEffect(() => {
    const handler = (e) => {
      if (e.detail === "certificate" || e.detail === "students" || e.detail === "assignments") {
        setActiveType(e.detail);
        setSearchParams((prev) => {
          const next = new URLSearchParams(prev);
          next.set("editor", e.detail);
          return next;
        });
      }
    };
    window.addEventListener("set-active-type", handler);
    return () => window.removeEventListener("set-active-type", handler);
  }, [setActiveType, setSearchParams]);

  useEffect(() => {
    const editor = searchParams.get("editor");
    if (editor === "certificate" || editor === "students" || editor === "assignments") {
      setActiveType(editor);
    }
  }, [searchParams, setActiveType]);

  useEffect(() => {
    if (
      activeType !== "certificate" &&
      searchParams.get("editor") === "certificate"
    ) {
      setSearchParams((prev) => {
        const next = new URLSearchParams(prev);
        next.delete("editor");
        return next;
      });
    }
    if (
      activeType !== "students" &&
      activeType !== "assignments" &&
      (searchParams.get("editor") === "students" ||
        searchParams.get("editor") === "assignments")
    ) {
      setSearchParams((prev) => {
        const next = new URLSearchParams(prev);
        next.delete("editor");
        return next;
      });
    }
  }, [activeType, searchParams, setSearchParams]);

  const handleInsert = useCallback(
    (tag, type) => {
      if (textareaRef.current) {
        const el = textareaRef.current;
        const start = el.selectionStart;
        const end = el.selectionEnd;
        const currentText = lessonForm.summary || "";
        const hasSelection = start !== end;

        if (type === "insert") {
          // Insert at cursor position (code blocks, tables, links, divider)
          const before = currentText.slice(0, start);
          const after = currentText.slice(end);
          setLessonForm((p) => ({
            ...p,
            summary: before + tag + after,
          }));
        } else if (type === "prefix") {
          // Block-level: prepend to current line or selected text
          if (hasSelection) {
            const before = currentText.slice(0, start);
            const after = currentText.slice(end);
            const selected = currentText.slice(start, end);
            setLessonForm((p) => ({
              ...p,
              summary: before + tag + selected + after,
            }));
          } else {
            // Prepend only to the line where cursor is
            const lineStart = currentText.lastIndexOf("\n", start - 1) + 1;
            const lineEnd = currentText.indexOf("\n", start);
            const beforeLine = currentText.slice(0, lineStart);
            const currentLine = lineEnd === -1
              ? currentText.slice(lineStart)
              : currentText.slice(lineStart, lineEnd);
            const afterLine = lineEnd === -1 ? "" : currentText.slice(lineEnd);
            setLessonForm((p) => ({
              ...p,
              summary: beforeLine + tag + currentLine + afterLine,
            }));
          }
        } else {
          // Symmetrical: wrap text with markers
          if (hasSelection) {
            const selected = currentText.slice(start, end);
            const before = currentText.slice(0, start);
            const after = currentText.slice(end);
            setLessonForm((p) => ({
              ...p,
              summary: before + tag + selected + tag + after,
            }));
          } else {
            setLessonForm((p) => ({
              ...p,
              summary: tag + currentText + tag,
            }));
          }
        }
        setTimeout(() => {
          el.focus();
        }, 10);
      }
    },
    [lessonForm.summary]
  );

  useEffect(() => {
    if (course?.title) {
      document.title = `${course.title} | Dashboard LMS`;
    }
  }, [course?.title]);

  if (loadingCourse) {
    return (
      <div className="flex h-96 flex-col items-center justify-center gap-3 text-zinc-400">
        <Loader2 className="h-8 w-8 animate-spin text-indigo-500" />
        <span className="text-sm">Memuat silabus kursus…</span>
      </div>
    );
  }

  if (!canOpenCourseEditor || isViewMode) {
    return (
      <CourseViewer
        course={course}
        modules={modules}
        lessonsByModule={lessonsByModule}
        quizzesByModule={quizzesByModule}
        assetsByLesson={assetsByLesson}
        selectedLessonId={selectedLessonId}
        hasLearningAccess={course?.has_access !== false}
        onBack={() => navigate(canManageCourses ? "/dashboard/courses/add" : "/dashboard/courses")}
        onStartLearning={startLearning}
        onSelectLesson={(lesson) => navigate(`/dashboard/lessons/${lesson.id}`)}
      />
    );
  }

  return (
    <TooltipProvider>
      <div className="flex h-screen flex-col bg-zinc-50 overflow-hidden">
        <CourseHeader
          course={course}
          sidebarOpen={sidebarOpen}
          setSidebarOpen={setSidebarOpen}
          navigate={navigate}
          setModuleForm={setModuleForm}
          emptyModuleForm={emptyModuleForm}
          loadModules={loadModules}
          setActiveType={setActiveType}
        />

        <div className="flex flex-1 min-h-0 overflow-hidden">
          <CourseSidebar
            sidebarOpen={sidebarOpen}
            modules={modules}
            lessonsByModule={lessonsByModule}
            quizzesByModule={quizzesByModule}
            expandedModules={expandedModules}
            toggleModule={toggleModule}
            selectedModuleId={selectedModuleId}
            selectedLessonId={selectedLessonId}
            activeType={activeType}
            handleSelectModule={handleSelectModule}
            handleSelectLesson={handleSelectLesson}
            handleCreateNewLesson={handleCreateNewLesson}
            deleteModule={deleteModule}
            deleteLesson={deleteLesson}
            canManageCourses={canManageCourses}
            handleOnDragEnd={handleOnDragEnd}
            navigate={navigate}
            handleCreateNewQuiz={handleCreateNewQuiz}
            handleSelectQuiz={handleSelectQuiz}
            ModuleItem={ModuleItem}
            onOpenSettings={() => setIsSettingsOpen(true)}
          />

          <main className="flex-1 min-w-0 overflow-y-auto">
            {!activeType && (
              <div className="h-full flex items-center justify-center text-center p-8">
                <div className="space-y-4 max-w-md">
                  <div className="h-16 w-16 rounded-2xl bg-indigo-50 border border-indigo-100 flex items-center justify-center mx-auto">
                    <Sparkles className="h-7 w-7 text-indigo-500" />
                  </div>
                  <div className="space-y-1">
                    <span className="text-xs font-semibold uppercase tracking-wider text-indigo-600">
                      Judul Kursus
                    </span>
                    <h1 className="text-2xl font-bold text-zinc-900">
                      {course?.title || "Detail Course"}
                    </h1>
                  </div>
                  <p className="text-sm text-zinc-500">
                    Pilih unit, modul, atau lesson dari panel kiri untuk mulai
                    mengedit kurikulum & materi.
                  </p>
                  <Button
                    size="sm"
                    onClick={() => {
                      setModuleForm(emptyModuleForm);
                      setActiveType("module");
                    }}
                    className="bg-indigo-600 hover:bg-indigo-700 mt-2"
                  >
                    <Plus className="h-4 w-4 mr-1.5" /> Buat Unit Pertama
                  </Button>
                </div>
              </div>
            )}

            {activeType === "quiz-create" && (
              <QuizEditor
                lessonForm={lessonForm}
                setLessonForm={setLessonForm}
                lessonsByModule={lessonsByModule}
                course={course}
                api={api}
                toast={toast}
                loadModules={loadModules}
              />
            )}

            {activeType === "quiz" && (
              <QuizManageView
                course={course}
                selectedModuleId={selectedModuleId}
                selectedLessonId={selectedLessonId}
                canManageCourses={canManageAssets}
                loadModules={loadModules}
              />
            )}

            {activeType === "module" && (
              <ModuleEditor
                moduleForm={moduleForm}
                setModuleForm={setModuleForm}
                canManageCourses={canManageCourses}
                saveModule={saveModule}
                busyKey={busyKey}
                isDirty={isDirty}
              />
            )}

            {activeType === "lesson" && (
              <LessonEditor
                lessonForm={lessonForm}
                setLessonForm={setLessonForm}
                canManageCourses={canManageCourses}
                canManageAssets={canManageAssets}
                saveLesson={saveLesson}
                busyKey={busyKey}
                textareaRef={textareaRef}
                RichToolbar={RichToolbar}
                handleInsert={handleInsert}
                markdownPreview={markdownPreview}
                assets={assetsByLesson[selectedLessonId] || []}
                assetTypes={assetTypes}
                acceptByAssetType={acceptByAssetType}
                assetForm={assetForm}
                setAssetForm={setAssetForm}
                uploadAssetFile={uploadAssetFile}
                uploadAssetThumbnail={uploadAssetThumbnail}
                deleteAsset={deleteAsset}
                addAsset={addAsset}
                selectedLessonId={selectedLessonId}
                isDirty={isDirty}
              />
            )}

            {activeType === "certificate" && (
              <div className="p-4 md:p-6 space-y-5 max-w-6xl mx-auto">
                <CertificateTemplateEditor courseId={course?.id || ""} />
              </div>
            )}

            {activeType === "students" && (
              <CourseStudentsView
                courseId={course?.id}
                api={api}
                toast={toast}
                view="students"
              />
            )}

            {activeType === "assignments" && (
              <CourseStudentsView
                courseId={course?.id}
                api={api}
                toast={toast}
                view="assignments"
              />
            )}
          </main>
        </div>
      </div>
      <CourseFormDialog
        isOpen={isSettingsOpen}
        onOpenChange={setIsSettingsOpen}
        data={course}
        categories={categories}
        onSuccess={fetchCourseDetail}
      />

      {/* Unsaved Changes Confirmation Modal */}
      <AlertDialog open={showUnsavedDialog} onOpenChange={handleCancelUnsavedNavigation}>
        <AlertDialogContent className="sm:max-w-md">
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center gap-2 text-slate-900 text-base">
              <AlertTriangle className="h-5 w-5 text-amber-500 shrink-0" />
              Perubahan Belum Disimpan
            </AlertDialogTitle>
            <AlertDialogDescription className="text-xs text-slate-600">
              Ada perubahan pada unit, lesson, atau kuis yang belum disimpan. Yakin ingin meninggalkan halaman tanpa menyimpan perubahan ini?
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter className="gap-2 sm:gap-0">
            <AlertDialogCancel
              onClick={handleCancelUnsavedNavigation}
              className="text-xs h-8"
            >
              Batal
            </AlertDialogCancel>
            <AlertDialogAction
              onClick={handleConfirmUnsavedNavigation}
              className="bg-amber-600 hover:bg-amber-700 text-white text-xs h-8 font-medium"
            >
              Tinggalkan Tanpa Menyimpan
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </TooltipProvider>
  );
}

export default DashboardLayout(CourseContentManagementPage);

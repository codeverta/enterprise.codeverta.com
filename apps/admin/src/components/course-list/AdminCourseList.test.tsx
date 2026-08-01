import React from "react";
import { act, render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter } from "react-router";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import api from "@/lib/api";
import AdminCourseList from "./AdminCourseList";

vi.mock("@/lib/api", () => ({
  default: {
    get: vi.fn(),
  },
}));

vi.mock("@/context/LanguageContext", () => ({
  useLanguage: () => ({ t: (key: string) => key }),
}));

vi.mock("sonner", () => ({
  toast: {
    error: vi.fn(),
    success: vi.fn(),
    loading: vi.fn(),
  },
}));

vi.mock("./CategoryPanel", () => ({ default: () => null }));
vi.mock("./CourseFormDialog", () => ({ default: () => null }));
vi.mock("./StatCard", () => ({
  default: ({ label, value }: { label: string; value: number }) => (
    <div>{label}: {value}</div>
  ),
}));

type ObserverCallback = (entries: Array<{ isIntersecting: boolean }>) => void;

const observerCallbacks: ObserverCallback[] = [];

class MockIntersectionObserver {
  private callback: ObserverCallback;

  constructor(callback: ObserverCallback) {
    this.callback = callback;
    observerCallbacks.push(callback);
  }

  observe() {}
  unobserve() {}
  disconnect() {}
}

const course = (id: string, title: string) => ({
  id,
  title,
  slug: id,
  status: "draft",
  short_description: "Deskripsi kursus",
  created_at: "2026-07-22T00:00:00Z",
  target_roles: [],
  category_roles: [],
  mentors: [],
});

const deferred = <T,>() => {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>((resolver) => {
    resolve = resolver;
  });
  return { promise, resolve };
};

describe("AdminCourseList infinite scroll", () => {
  beforeEach(() => {
    observerCallbacks.length = 0;
    vi.stubGlobal("IntersectionObserver", MockIntersectionObserver);
    Object.defineProperty(window, "scrollY", {
      configurable: true,
      writable: true,
      value: 0,
    });
  });

  afterEach(() => {
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
  });

  it("keeps existing course cards mounted while the next page is loading", async () => {
    const nextPage = deferred<{
      data: { data: ReturnType<typeof course>[]; pagination: { total_pages: number } };
    }>();

    vi.mocked(api.get).mockImplementation((url, config) => {
      if (url === "/lms/courses") {
        if (config?.params?.page === 2) {
          return nextPage.promise;
        }
        return Promise.resolve({
          data: {
            data: [course("course-1", "Course halaman pertama")],
            pagination: { total_pages: 2 },
          },
        });
      }
      if (url === "/lms/courses/stats") {
        return Promise.resolve({
          data: { data: { total: 2, published: 0, draft: 2, categories: 1 } },
        });
      }
      return Promise.resolve({ data: { data: [] } });
    });

    render(
      <MemoryRouter>
        <AdminCourseList user={{ role: 99 }} />
      </MemoryRouter>
    );

    expect(await screen.findByText("Course halaman pertama", {}, { timeout: 2000 })).toBeInTheDocument();
    window.scrollY = 900;

    await waitFor(() => expect(observerCallbacks.length).toBeGreaterThan(0));
    await act(async () => {
      observerCallbacks[observerCallbacks.length - 1]([{ isIntersecting: true }]);
    });

    await waitFor(() => {
      expect(api.get).toHaveBeenCalledWith(
        "/lms/courses",
        expect.objectContaining({ params: expect.objectContaining({ page: 2 }) })
      );
    });

    expect(screen.getByText("Course halaman pertama")).toBeInTheDocument();
    expect(screen.queryByText("Memuat data kursus...")).not.toBeInTheDocument();
    expect(screen.getByText("Memuat lebih banyak kursus...")).toBeInTheDocument();
    expect(window.scrollY).toBe(900);

    await act(async () => {
      nextPage.resolve({
        data: {
          data: [course("course-2", "Course halaman kedua")],
          pagination: { total_pages: 2 },
        },
      });
    });

    expect(await screen.findByText("Course halaman kedua")).toBeInTheDocument();
    expect(screen.getByText("Course halaman pertama")).toBeInTheDocument();
    expect(window.scrollY).toBe(900);
  });
});

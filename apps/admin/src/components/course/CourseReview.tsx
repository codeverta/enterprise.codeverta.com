import React from 'react'
import { Star, ThumbsUp } from "lucide-react";

function RatingStars({ rating = 0, count = 0 }) {
  return (
    <div className="flex items-center gap-1.5">
      <div className="flex items-center gap-0.5">
        {[1, 2, 3, 4, 5].map((s) => (
          <Star
            key={s}
            className={`h-4 w-4 ${
              s <= Math.round(rating)
                ? "fill-amber-400 text-amber-400"
                : "fill-slate-200 text-slate-200"
            }`}
          />
        ))}
      </div>
      <span className="text-sm font-semibold text-slate-700">
        {rating.toFixed(1)}
      </span>
      <span className="text-sm text-slate-400">
        ({count.toLocaleString()} ratings)
      </span>
    </div>
  );
}

function CourseReview({
    stats,
}: {
    stats: {
        rating: number;
        total_reviews: number;
    };
}) {
  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-6 sm:flex-row sm:items-center">
        <div className="flex flex-col items-center justify-center rounded-xl border border-slate-200 bg-white px-8 py-6">
          <span className="text-5xl font-bold text-slate-900">
            {stats.rating.toFixed(1)}
          </span>
          <RatingStars rating={stats.rating} count={0} />
          <span className="mt-1 text-xs text-slate-400">Course Rating</span>
        </div>
        <div className="flex-1 space-y-2">
          {[5, 4, 3, 2, 1].map((star) => {
            const pct =
              star === 5
                ? 62
                : star === 4
                ? 23
                : star === 3
                ? 9
                : star === 2
                ? 4
                : 2;
            return (
              <div
                key={star}
                className="flex items-center gap-2 text-xs text-slate-500"
              >
                <span className="w-3 text-right">{star}</span>
                <Star className="h-3 w-3 fill-amber-400 text-amber-400" />
                <div className="h-2 flex-1 overflow-hidden rounded-full bg-slate-100">
                  <div
                    className="h-full rounded-full bg-amber-400"
                    style={{ width: `${pct}%` }}
                  />
                </div>
                <span className="w-8 text-right">{pct}%</span>
              </div>
            );
          })}
        </div>
      </div>

      {/* Sample reviews */}
      <div className="space-y-4">
        {[
          {
            name: "Andi Prasetyo",
            avatar: "A",
            rating: 5,
            date: "2 weeks ago",
            comment:
              "Materi sangat lengkap dan mudah dipahami. Instruktur menjelaskan dengan sangat baik.",
            helpful: 24,
          },
          {
            name: "Sari Dewi",
            avatar: "S",
            rating: 4,
            date: "1 month ago",
            comment:
              "Konten berkualitas tinggi. Beberapa bagian bisa lebih detail tapi secara keseluruhan sangat bagus.",
            helpful: 11,
          },
        ].map((review, i) => (
          <div
            key={i}
            className="space-y-2 rounded-xl border border-slate-200 bg-white p-4"
          >
            <div className="flex items-center gap-3">
              <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-purple-100 text-sm font-bold text-purple-600">
                {review.avatar}
              </div>
              <div>
                <p className="text-sm font-medium text-slate-800">
                  {review.name}
                </p>
                <div className="flex items-center gap-2">
                  <div className="flex">
                    {[1, 2, 3, 4, 5].map((s) => (
                      <Star
                        key={s}
                        className={`h-3 w-3 ${
                          s <= review.rating
                            ? "fill-amber-400 text-amber-400"
                            : "fill-slate-200 text-slate-200"
                        }`}
                      />
                    ))}
                  </div>
                  <span className="text-xs text-slate-400">{review.date}</span>
                </div>
              </div>
            </div>
            <p className="text-sm leading-6 text-slate-600">{review.comment}</p>
            <button
              type="button"
              className="flex items-center gap-1.5 text-xs text-slate-400 hover:text-slate-600 transition-colors"
            >
              <ThumbsUp className="h-3.5 w-3.5" />
              Helpful ({review.helpful})
            </button>
          </div>
        ))}
      </div>
    </div>
  );
}

export default CourseReview
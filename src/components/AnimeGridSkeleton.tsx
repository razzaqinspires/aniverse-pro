"use client";

import Skeleton from "./Skeleton";

interface AnimeGridSkeletonProps {
  count?: number;
}

/** Grid of poster+title skeletons used while anime lists load. */
export default function AnimeGridSkeleton({ count = 12 }: AnimeGridSkeletonProps) {
  return (
    <div className="anime-grid" aria-hidden="true">
      {Array.from({ length: count }).map((_, i) => (
        <div key={i} style={{ display: "flex", flexDirection: "column", gap: 8 }}>
          <Skeleton height={210} style={{ aspectRatio: "2/3", height: "auto" }} />
          <Skeleton width="80%" height={14} />
          <Skeleton width="40%" height={12} />
        </div>
      ))}
    </div>
  );
}

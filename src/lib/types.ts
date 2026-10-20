import type { CivId } from '@/constants/civs';

export type BuildStep = {
  id: string;
  /** Seconds from match start. `null` = untimed, happens right after the previous step. */
  time: number | null;
  /** Icon ids from the generated icon manifest. */
  icons: string[];
  note: string;
};

export type BuildOrder = {
  id: string;
  title: string;
  civ: CivId;
  description: string;
  steps: BuildStep[];
  createdAt: number;
  updatedAt: number;
  /** Set when the build is published by this user, or imported from the community. */
  remote?: {
    id: string;
    authorId: string;
    authorName: string;
    /** True when this device's user is the author (published from here). */
    mine: boolean;
  };
};

/** Shape stored in the community backend; `steps` keeps the same format as local builds. */
export type CommunityBuild = {
  id: string;
  author_id: string;
  author_name: string;
  title: string;
  civ: CivId;
  description: string;
  steps: BuildStep[];
  upvotes: number;
  created_at: string;
  updated_at: string;
  /** Filled client-side from the votes table. */
  voted?: boolean;
};

export interface User {
  id: string;
  name: string;
  email: string;
  avatar?: string | null;
  headline?: string | null;
  bio?: string | null;
  links?: Record<string, string>;
  roles: string[];
  locale: string;
  isVerified: boolean;
  status?: string;
}

export interface CourseCard {
  id: string;
  title: string;
  subtitle?: string | null;
  slug: string;
  image?: string | null;
  priceCents: number;
  currency: string;
  level: string;
  language?: string;
  ratingAvg: number;
  ratingCount: number;
  studentsCount: number;
  durationTotalSec?: number;
  featured?: boolean;
  instructorName?: string;
  instructorId?: string;
}

export interface Lecture {
  id: string;
  title: string;
  type: 'video' | 'article' | 'quiz' | 'assignment';
  durationSec: number;
  isFreePreview?: boolean;
  videoUrl?: string | null;
  articleBody?: string | null;
  locked?: boolean;
  completed?: boolean;
  lastPositionSec?: number;
}

export interface Section {
  id: string;
  title: string;
  order?: number;
  lectures: Lecture[];
}

export interface CourseDetail extends CourseCard {
  description?: string | null;
  learningObjectives?: string[];
  requirements?: string[];
  targetAudience?: string[];
  promoVideo?: string | null;
  status: string;
  publishedAt?: string | null;
  updatedAt?: string;
  category?: { id: string; name: string; slug: string } | null;
  instructor?: { id: string; name: string; avatar?: string | null; headline?: string | null; bio?: string | null } | null;
  curriculum: Section[];
  ratingBreakdown: Record<number, number>;
  lectureCount: number;
  sectionCount: number;
  enrolled: boolean;
  isOwner: boolean;
  rejectionNote?: string | null;
}

export interface Category {
  id: string;
  name: string;
  slug: string;
  icon?: string | null;
  description?: string | null;
  parentId?: string | null;
  children?: Category[];
}

export interface Paginated<T> {
  items: T[];
  page: number;
  limit: number;
  total: number;
  totalPages: number;
}

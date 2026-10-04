/**
 * Dearr V1 Admin Reviews & Ratings Domain Model & Session Storage
 *
 * Source of Truth for Dearr Founder/Admin Reviews Moderation UI (Task A-16).
 * Manages customer review submissions, approval workflows, rating distribution,
 * and internal administrative notes.
 *
 * NOTE: In V1 prototype, this review data is strictly isolated to the admin
 * moderation dashboard and is NOT fabricated into storefront product rating badges.
 */

export type ReviewStatus = "pending" | "approved" | "rejected" | "flagged";

export interface AdminReview {
  id: string;
  productId: string;
  productSlug: string;
  productName: string;
  productImage?: string;
  customerId: string;
  customerName: string;
  customerEmail: string;
  rating: number; // 1 to 5
  title: string;
  comment: string;
  status: ReviewStatus;
  createdAt: string; // ISO string
  updatedAt: string; // ISO string
  adminNote?: string;
  verifiedPurchase: boolean;
}

export interface ReviewMetrics {
  totalReviews: number;
  pendingReviews: number;
  approvedReviews: number;
  flaggedReviews: number;
  averageRating: number;
  verifiedPurchases: number;
}

export const ADMIN_REVIEWS_STORAGE_KEY = "dearr_admin_reviews";

/**
 * Realistic Base Demo Reviews for Dearr 3D Printing Store Moderation Queue
 */
export const BASE_REVIEWS: AdminReview[] = [
  {
    id: "rev_dearr_001",
    productId: "sp-01",
    productSlug: "3d-printed-radha-krishna-figurine-12-5cm",
    productName: "3D Printed Radha Krishna Figurine (12.5 cm)",
    productImage: "/product-samples/1.jpeg",
    customerId: "cust_dearr_001",
    customerName: "Aarav Sharma",
    customerEmail: "aarav.sharma@example.com",
    rating: 5,
    title: "Exquisite details and flawless finish!",
    comment:
      "The layer lines are virtually invisible! The pastel matte finish feels divine on my home mandir altar. Sturdy PLA material and arrived safely packed.",
    status: "approved",
    createdAt: "2026-09-26T14:20:00.000Z",
    updatedAt: "2026-09-27T09:10:00.000Z",
    adminNote: "Verified buyer from order DEAR-84021. Aligns with quality guidelines.",
    verifiedPurchase: true,
  },
  {
    id: "rev_dearr_002",
    productId: "sp-02",
    productSlug: "3d-printed-golden-ganesha-idol",
    productName: "3D Printed Golden Ganesha Idol",
    productImage: "/product-samples/2.jpeg",
    customerId: "cust_dearr_002",
    customerName: "Priya Patel",
    customerEmail: "priya.patel@example.com",
    rating: 5,
    title: "Mesmerizing gold silk luster",
    comment:
      "Placed this on my work study desk. The light catch on the silk PLA filament is gorgeous. Perfect proportions and very stable base.",
    status: "approved",
    createdAt: "2026-09-28T16:00:00.000Z",
    updatedAt: "2026-09-28T17:30:00.000Z",
    adminNote: "Approved for upcoming V1 review showcase.",
    verifiedPurchase: true,
  },
  {
    id: "rev_dearr_003",
    productId: "sp-07",
    productSlug: "articulated-winged-dragon-30cm",
    productName: "Articulated Winged Dragon (30cm)",
    productImage: "/product-samples/7.jpeg",
    customerId: "cust_dearr_003",
    customerName: "Rohan Verma",
    customerEmail: "rohan.verma@example.com",
    rating: 4,
    title: "Great flex articulation, wings are slightly delicate",
    comment:
      "The dual-color silk finish in emerald and gold is stunning. All 24 articulated joints move smoothly. Be gentle with wing tips when unpacking.",
    status: "pending",
    createdAt: "2026-09-29T10:15:00.000Z",
    updatedAt: "2026-09-29T10:15:00.000Z",
    adminNote: "Constructive feedback regarding wing packaging; queued for founder approval.",
    verifiedPurchase: true,
  },
  {
    id: "rev_dearr_004",
    productId: "sp-04",
    productSlug: "geometric-spiral-succulent-planter",
    productName: "Geometric Spiral Succulent Planter",
    productImage: "/product-samples/4.jpeg",
    customerId: "cust_dearr_004",
    customerName: "Ananya Iyer",
    customerEmail: "ananya.iyer@example.com",
    rating: 5,
    title: "Drainage hole works well, lovely modern touch",
    comment:
      "Fits a 2.5-inch nursery succulent pot seamlessly. The spiral math geometry looks so chic in my balcony garden.",
    status: "approved",
    createdAt: "2026-09-30T08:30:00.000Z",
    updatedAt: "2026-09-30T09:00:00.000Z",
    verifiedPurchase: true,
  },
  {
    id: "rev_dearr_005",
    productId: "sp-08",
    productSlug: "custom-spotify-code-keychain",
    productName: "Custom Spotify Code Keychain",
    productImage: "/product-samples/8.jpeg",
    customerId: "cust_dearr_007",
    customerName: "Kavita Rao",
    customerEmail: "kavita.rao@example.com",
    rating: 4,
    title: "Scans instantly on the Spotify app!",
    comment:
      "Made for our anniversary song. The embossed acrylic/PLA contrast is crisp and scans without any glare issue.",
    status: "approved",
    createdAt: "2026-09-23T11:45:00.000Z",
    updatedAt: "2026-09-23T15:20:00.000Z",
    verifiedPurchase: true,
  },
  {
    id: "rev_dearr_006",
    productId: "sp-06",
    productSlug: "lord-shiva-in-deep-meditation-statue",
    productName: "Lord Shiva in Deep Meditation Statue",
    productImage: "/product-samples/6.jpeg",
    customerId: "cust_dearr_006",
    customerName: "Sneha Reddy",
    customerEmail: "sneha.reddy@example.com",
    rating: 5,
    title: "Captures serene meditative aura",
    comment:
      "Deep charcoal grey with subtle moonlight highlights. The facial calm in 3D relief is remarkable. Arrived in reinforced protective packaging.",
    status: "pending",
    createdAt: "2026-09-30T11:00:00.000Z",
    updatedAt: "2026-09-30T11:00:00.000Z",
    adminNote: "Awaiting image verification from buyer before storefront approval.",
    verifiedPurchase: true,
  },
  {
    id: "rev_dearr_007",
    productId: "sp-09",
    productSlug: "cyberpunk-desk-cable-organizer",
    productName: "Cyberpunk Desk Cable Organizer",
    productImage: "/product-samples/9.jpeg",
    customerId: "cust_dearr_008",
    customerName: "Arjun Nair",
    customerEmail: "arjun.nair@example.com",
    rating: 2,
    title: "Slot thickness was too snug for braided HDMI",
    comment:
      "Nice aesthetic look, but the middle channel struggled with my heavy-gauge braided monitor cable. Better suited for standard USB-C wires.",
    status: "approved",
    createdAt: "2026-09-21T14:10:00.000Z",
    updatedAt: "2026-09-22T09:40:00.000Z",
    adminNote: "Honest sizing critique; approved for transparency.",
    verifiedPurchase: false,
  },
  {
    id: "rev_dearr_008",
    productId: "sp-10",
    productSlug: "articulated-crystal-dragon-25cm",
    productName: "Articulated Crystal Dragon (25cm)",
    productImage: "/product-samples/10.jpeg",
    customerId: "cust_dearr_011",
    customerName: "Rahul Kumar",
    customerEmail: "rahul.k@example.com",
    rating: 5,
    title: "Sensory fidget perfection",
    comment:
      "The crystalline spikes shimmer brilliantly under desk lamps. It has an addictive, satisfying clack sound when articulated. Superb print density.",
    status: "approved",
    createdAt: "2026-09-29T18:20:00.000Z",
    updatedAt: "2026-09-30T08:15:00.000Z",
    adminNote: "VIP reviewer from Gurgaon.",
    verifiedPurchase: true,
  },
  {
    id: "rev_dearr_009",
    productId: "sp-03",
    productSlug: "modern-minimalist-ganesha-veena-sculpture",
    productName: "Modern Minimalist Ganesha Sculpture",
    productImage: "/product-samples/3.jpeg",
    customerId: "cust_dearr_012",
    customerName: "Divya Choudhury",
    customerEmail: "divya.c@example.com",
    rating: 1,
    title: "Cheap plastic junk visit discountpromo.xyz for real deals",
    comment:
      "Do not buy from here, go to https://discountpromo.xyz/deal to get 90% off all Indian handicrafts and brass statues immediately!",
    status: "flagged",
    createdAt: "2026-09-30T19:40:00.000Z",
    updatedAt: "2026-09-30T19:45:00.000Z",
    adminNote: "AUTOMATED SPAM FILTER: Flagged for external promotional link injection.",
    verifiedPurchase: false,
  },
  {
    id: "rev_dearr_010",
    productId: "sp-05",
    productSlug: "meditative-buddha-head-bust-15cm",
    productName: "Meditative Buddha Head Bust (15cm)",
    productImage: "/product-samples/5.jpeg",
    customerId: "cust_dearr_014",
    customerName: "Suresh Pillai",
    customerEmail: "suresh.pillai@example.com",
    rating: 1,
    title: "Fake store terrible service and completely broken item",
    comment:
      "Worst service ever seen in India. Complete fraud seller. Demand instant full cashback now or police report will follow.",
    status: "rejected",
    createdAt: "2026-06-03T12:00:00.000Z",
    updatedAt: "2026-06-03T14:30:00.000Z",
    adminNote: "Blocked account review rejected due to abusive threat and unverified chargeback claim.",
    verifiedPurchase: false,
  },
  {
    id: "rev_dearr_011",
    productId: "sp-11",
    productSlug: "hanuman-chalisa-relief-wall-plaque",
    productName: "Hanuman Chalisa Relief Wall Plaque",
    productImage: "/product-samples/11.jpeg",
    customerId: "cust_dearr_015",
    customerName: "Pooja Deshmukh",
    customerEmail: "pooja.deshmukh@example.com",
    rating: 5,
    title: "Devanagari typography is razor sharp!",
    comment:
      "I was amazed that each shloka character was legibly printed in micro-relief. Mounts easily on wall with double-sided foam tape provided.",
    status: "approved",
    createdAt: "2026-09-30T09:10:00.000Z",
    updatedAt: "2026-09-30T10:00:00.000Z",
    adminNote: "High fidelity macro photo submitted.",
    verifiedPurchase: true,
  },
  {
    id: "rev_dearr_012",
    productId: "sp-01",
    productSlug: "3d-printed-radha-krishna-figurine-12-5cm",
    productName: "3D Printed Radha Krishna Figurine (12.5 cm)",
    productImage: "/product-samples/1.jpeg",
    customerId: "cust_dearr_016",
    customerName: "Tenzin Norbu",
    customerEmail: "tenzin.norbu@example.com",
    rating: 3,
    title: "Good sculpt, but smaller than imagined",
    comment:
      "Check dimensions carefully before ordering. It is exactly 12.5 cm as described, which felt compact on our prayer mantel.",
    status: "pending",
    createdAt: "2026-09-30T21:15:00.000Z",
    updatedAt: "2026-09-30T21:15:00.000Z",
    verifiedPurchase: false,
  },
];

/**
 * Retrieve all Admin Reviews from sessionStorage or fallback to BASE_REVIEWS.
 */
export function getAllAdminReviews(): AdminReview[] {
  if (typeof window !== "undefined") {
    try {
      const raw = sessionStorage.getItem(ADMIN_REVIEWS_STORAGE_KEY);
      if (raw) {
        const parsed = JSON.parse(raw);
        if (Array.isArray(parsed) && parsed.length > 0) {
          return parsed;
        }
      } else {
        sessionStorage.setItem(
          ADMIN_REVIEWS_STORAGE_KEY,
          JSON.stringify(BASE_REVIEWS)
        );
      }
    } catch (e) {
      console.error("Failed to read admin reviews from sessionStorage:", e);
    }
  }
  return BASE_REVIEWS;
}

/**
 * Retrieve a single Admin Review by ID.
 */
export function getAdminReviewById(id: string): AdminReview | null {
  const all = getAllAdminReviews();
  return all.find((r) => r.id === id) || null;
}

/**
 * Save or insert an Admin Review.
 */
export function saveAdminReview(review: AdminReview): AdminReview {
  const all = getAllAdminReviews();
  const existingIndex = all.findIndex((r) => r.id === review.id);
  let updatedList: AdminReview[];

  if (existingIndex >= 0) {
    updatedList = [...all];
    updatedList[existingIndex] = review;
  } else {
    updatedList = [review, ...all];
  }

  if (typeof window !== "undefined") {
    try {
      sessionStorage.setItem(
        ADMIN_REVIEWS_STORAGE_KEY,
        JSON.stringify(updatedList)
      );
    } catch (e) {
      console.error("Failed to save admin review to sessionStorage:", e);
    }
  }

  return review;
}

/**
 * Update an existing review with partial properties.
 */
export function updateAdminReview(
  id: string,
  updates: Partial<AdminReview>
): AdminReview | null {
  const all = getAllAdminReviews();
  const index = all.findIndex((r) => r.id === id);
  if (index === -1) return null;

  const current = all[index];
  const updated: AdminReview = {
    ...current,
    ...updates,
    id: current.id,
    updatedAt: new Date().toISOString(),
  };

  all[index] = updated;

  if (typeof window !== "undefined") {
    try {
      sessionStorage.setItem(
        ADMIN_REVIEWS_STORAGE_KEY,
        JSON.stringify(all)
      );
    } catch (e) {
      console.error("Failed to update admin review in sessionStorage:", e);
    }
  }

  return updated;
}

/**
 * Update review moderation lifecycle status and optional admin note.
 */
export function updateAdminReviewStatus(
  id: string,
  newStatus: ReviewStatus,
  adminNote?: string
): AdminReview | null {
  const review = getAdminReviewById(id);
  if (!review) return null;

  return updateAdminReview(id, {
    status: newStatus,
    adminNote: adminNote !== undefined ? adminNote : review.adminNote,
  });
}

/**
 * Calculate aggregate moderation metrics from review list.
 */
export function getReviewMetrics(reviewsList?: AdminReview[]): ReviewMetrics {
  const reviews = reviewsList || getAllAdminReviews();

  const totalReviews = reviews.length;
  const pendingReviews = reviews.filter((r) => r.status === "pending").length;
  const approvedReviews = reviews.filter((r) => r.status === "approved").length;
  const flaggedReviews = reviews.filter((r) => r.status === "flagged").length;
  const verifiedPurchases = reviews.filter((r) => r.verifiedPurchase).length;

  const totalRatingPoints = reviews.reduce((sum, r) => sum + r.rating, 0);
  const averageRating =
    totalReviews > 0
      ? Math.round((totalRatingPoints / totalReviews) * 10) / 10
      : 0;

  return {
    totalReviews,
    pendingReviews,
    approvedReviews,
    flaggedReviews,
    averageRating,
    verifiedPurchases,
  };
}

export {
  getDbConfig,
  getDbPool,
  query,
  withTransaction,
  testDbConnection,
  type DbConfig,
} from "./db";

export {
  findProfileByEmail,
  findProfileWithPasswordByEmail,
  findProfileById,
  createProfile,
  updateProfile,
  updateCustomerProfile,
  updateProfilePassword,
  type UserProfile,
  type UserProfileWithPassword,
  type CreateProfileInput,
  type UpdateProfileInput,
} from "./profile";

export {
  SESSION_COOKIE_NAME,
  SESSION_EXPIRY_SECONDS,
  AuthError,
  hashPassword,
  comparePassword,
  createSessionToken,
  verifySessionToken,
  getSessionCookieOptions,
  attachSessionCookie,
  attachClearSessionCookie,
  setSessionCookie,
  clearSession,
  createSession,
  getSession,
  getCurrentUser,
  requireUser,
  requireAdmin,
  assertOwnerOrAdmin,
  handleAuthError,
  type SessionPayload,
} from "./auth";

export {
  MAX_PRODUCT_IMAGE_SIZE_BYTES,
  ALLOWED_IMAGE_MIME_TYPES,
  ALLOWED_IMAGE_EXTENSIONS,
  StorageError,
  getProductUploadDir,
  detectImageSignature,
  validateProductImage,
  generateUniqueImageFilename,
  resolveProductImagePath,
  saveProductImage,
  deleteProductImage,
  type AllowedMimeType,
  type StoredProductImage,
} from "./product-storage";

export {
  ProductValidationError,
  generateSlug,
  validateSlug,
  findProductById,
  findProductBySlug,
  getRelatedProducts,
  listProducts,
  createProduct,
  updateProduct,
  deactivateProduct,
  findTrendingProducts,
  type Product,
  type ProductImage,
  type ProductVariant,
  type ProductCategoryInfo,
  type ProductListFilters,
  type CreateProductInput,
  type UpdateProductInput,
} from "./product";

export {
  CategoryValidationError,
  generateCategorySlug,
  validateCategorySlug,
  findCategoryById,
  findCategoryBySlug,
  listCategories,
  createCategory,
  updateCategory,
  recordCategoryView,
  getPopularCategories,
  type Category,
  type CreateCategoryInput,
  type UpdateCategoryInput,
  type CategoryListFilters,
} from "./category";

export {
  DiscountValidationError,
  formatMysqlDateTime,
  computeDiscountStatus,
  normalizeDiscountCode,
  findDiscountById,
  findDiscountByCode,
  listDiscounts,
  getActiveDiscounts,
  getApplicableDiscountForProduct,
  computeDiscountAmount,
  createDiscount,
  updateDiscount,
  deleteDiscount,
  type DiscountType,
  type DiscountScope,
  type DiscountDerivedStatus,
  type Discount,
  type CreateDiscountInput,
  type UpdateDiscountInput,
  type DiscountListFilters,
  type ApplicableDiscountResult,
} from "./discount";

export {
  WishlistValidationError,
  validateProductId,
  getOrCreateWishlistForUser,
  getWishlistForUser,
  addProductToWishlist,
  removeProductFromWishlist,
  clearWishlistForUser,
  isProductInWishlist,
  type WishlistProductSummary,
  type WishlistItem,
  type WishlistRecord,
  type AddWishlistItemResult,
} from "./wishlist";

export {
  CartValidationError,
  validateId,
  validateQuantity,
  getOrCreateActiveCartForUser,
  getCartForUser,
  addCartItem,
  updateCartItemQuantity,
  removeCartItem,
  clearCartForUser,
  type CartProductSummary,
  type CartVariantSummary,
  type CartItemPricing,
  type CartItemStock,
  type CartItemRecord,
  type CartTotals,
  type CartRecord,
  type AddCartItemInput,
} from "./cart";

export {
  OrderValidationError,
  createOrderFromCart,
  getOrderById,
  listCustomerOrders,
  listAllOrders,
  updateOrderStatus,
  updatePaymentStatus,
  cancelOrder,
  type OrderStatus,
  type PaymentStatus,
  type OrderItemSnapshot,
  type OrderRecord,
  type OrderSummary,
  type CreateOrderInput,
  type OrderListFilters,
} from "./order";

export {
  PaymentValidationError,
  processTestPayment,
  getPaymentsByOrderId,
  createRazorpayPaymentOrder,
  verifyRazorpayPayment,
  settlePaidOrder,
  handlePaymentFailure,
  handlePaymentCancellation,
  reconcileRazorpayPayment,
  type PaymentRecordStatus,
  type PaymentRecord,
  type TestPaymentOutcome,
  type ProcessTestPaymentInput,
  type ProcessTestPaymentResult,
  type CreateRazorpayPaymentOrderInput,
  type CreateRazorpayPaymentOrderResult,
  type VerifyRazorpayPaymentInput,
  type VerifyRazorpayPaymentResult,
  type SettlePaidOrderInput,
  type SettlePaidOrderResult,
  type HandlePaymentFailureInput,
  type HandlePaymentFailureResult,
  type HandlePaymentCancellationInput,
  type HandlePaymentCancellationResult,
  type ReconcileRazorpayPaymentInput,
  type ReconcileRazorpayPaymentResult,
} from "./payment";

export {
  getAdminDashboardMetrics,
  type AdminDashboardMetrics,
} from "./dashboard";

export {
  RazorpayConfigError,
  isRazorpayConfigured,
  isRazorpayTestMode,
  getRazorpayConfig,
  getRazorpayClient,
  verifyRazorpaySignature,
  type RazorpayMode,
  type SafeRazorpayConfig,
} from "./razorpay";


export {
  getGoogleOAuthConfig,
  generateOAuthState,
  buildGoogleAuthUrl,
  exchangeGoogleCode,
  verifyGoogleIdToken,
  findProfileByGoogleSubject,
  findProfileEmailAndAuthType,
  createGoogleProfile,
  linkGoogleSubjectToProfile,
  GOOGLE_STATE_COOKIE,
  GOOGLE_STATE_MAX_AGE,
  type GoogleIdentityPayload,
  type GoogleOAuthConfig,
} from "./google-oauth";

export {
  listAdminCustomers,
  getAdminCustomerById,
  updateAdminCustomerRecord,
  type CustomerListFilters,
} from "./customer";

export {
  listAdminReviews,
  getAdminReviewById,
  updateAdminReview,
  type ReviewListFilters,
} from "./review";

export {
  getStoreSettings,
  updateStoreSettings,
} from "./settings";


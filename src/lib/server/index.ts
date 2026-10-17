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
  incrementTokenVersion,
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
  assertSafeOrigin,
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
  validateHexColor,
  generateColorSlug,
  toPublicUrl,
  toProductImage,
  toProductColor,
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
  type ProductColor,
  type ProductCategoryInfo,
  type ProductListFilters,
  type CreateProductInput,
  type UpdateProductInput,
  type CreateProductColorInput,
  type CreateProductImageInput,
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
  addCartItemsBatch,
  updateCartItemQuantity,
  removeCartItem,
  clearCartForUser,
  type CartProductSummary,
  type CartVariantSummary,
  type CartColorSummary,
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
  createOrderFromBuyNow,
  getOrderById,
  listCustomerOrders,
  listAllOrders,
  updateOrderStatus,
  updatePaymentStatus,
  cancelOrder,
  validateShippingAddress,
  generateOrderNumber,
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
  checkRateLimit,
  clearRateLimit,
} from "./settings";

export {
  resolveReportingPeriod,
  getOrderSummaryMetrics,
  mapToCanonicalBucket,
  formatKolkataSqlDateTime,
  formatKolkataDisplay,
  getNowInAsiaKolkata,
  kolkataToUtcDate,
  PLACED_ORDER_SQL_PREDICATE,
  REVENUE_ELIGIBLE_SQL_PREDICATE,
  type ReportingPeriod,
  type ResolvedReportingPeriod,
  type OrderDashboardMetrics,
  type CanonicalMetricBucket,
  AnalyticsValidationError,
} from "./order-analytics";

export {
  createCheckoutAttempt,
  createCheckoutAttemptFromCart,
  createBuyNowCheckoutAttempt,
  releaseCheckoutAttemptReservations,
  finalizeOrderFromAttempt,
  getCheckoutAttemptById,
  getCheckoutAttemptByProviderOrder,
  updateCheckoutAttemptProviderOrder,
  markAttemptConverted,
  cleanupCheckoutAttempts,
  reconcileLatePaymentAttempt,
  ATTEMPT_EXPIRY_MINUTES,
  ATTEMPT_RETENTION_DAYS,
  type CheckoutAttemptRecord,
  type CheckoutAttemptStatus,
  type CreateCheckoutAttemptInput,
  type BuyNowItemInput,
  CheckoutAttemptError,
  markAttemptAbandoned,
  markAttemptFailed,
  recordRecoveryShown,
  getAttemptRecoveryStatus,
  ABANDONED_ATTEMPT_RETENTION_DAYS,
} from "./checkout-attempt";

export {
  sanitizeCsvCell,
  getExportFilename,
  generateSummaryCsv,
  streamOrdersListCsv,
  recordExportAudit,
  resolveOrderExportAmounts,
  type ExportType,
} from "./order-export";

export {
  recordInternalEvent,
  getInternalEventsForAttempt,
  type InternalEventType,
  type RecordInternalEventInput,
  type InternalEventRecord,
} from "./events";

export {
  recordProductPriceChange,
  recordPriceChange,
  getProductPriceHistory,
  type RecordPriceChangeInput,
  type ProductPriceHistoryRecord,
} from "./price-history";

export {
  getLowerPricedAlternatives,
  findLowerPricedAlternatives,
  swapCartItemForAlternative,
  AlternativesError,
  AlternativesConflictError,
  type AlternativeItem,
  type SwapCartItemInput,
} from "./alternatives";

export {
  submitCheckoutFeedback,
  getFeedbackForAttempt,
  getAttemptFeedback,
  sanitizeFeedbackComment,
  FeedbackValidationError,
  type SubmitFeedbackInput,
  type CheckoutFeedbackRecord,
} from "./checkout-feedback";

export {
  recordNotificationConsent,
  withdrawNotificationConsent,
  subscribeNotificationConsent,
  getNotificationConsentsForUser,
  unsubscribeNotificationConsent,
  getConsentsForAttempt,
  ConsentValidationError,
  type ConsentChannel,
  type RecordConsentInput,
  type SubscribeNotificationConsentInput,
  type NotificationConsentRecord,
} from "./notification-consent";

export {
  getAbandonmentSummaryMetrics,
  getRecentAbandonedCheckouts,
  listRecentAbandonedCheckouts,
  generateAbandonmentCsv,
  streamAbandonmentCsv,
  type AbandonmentSummaryMetrics,
  type AbandonedCheckoutRow,
} from "./abandonment-analytics";

export {
  withPrivateCacheHeaders,
  jsonPrivate,
  PRIVATE_CACHE_CONTROL,
} from "./response";

export {
  sendPasswordResetOtp,
  sendPaymentConfirmation,
  queueEmailOutboxJob,
  dispatchEmailOutboxJob,
  retryPendingEmailOutboxJobs,
  escapeHtml,
  renderPasswordResetOtpTemplate,
  renderPaymentConfirmationTemplate,
  DEFAULT_SENDER,
  DEFAULT_SUPPORT_EMAIL,
  type TransactionalEmailType,
  type PasswordResetEmailParams,
  type PaymentConfirmationEmailParams,
  type EmailDispatchResult,
} from "./email";

export {
  requestPasswordResetOtp,
  verifyPasswordResetOtp,
  confirmPasswordReset,
  checkAndIncrementAccountDailyOtpLimit,
  OtpError,
  OTP_EXPIRY_MINUTES,
  MAX_VERIFICATION_ATTEMPTS,
  MAX_DAILY_OTP_REQUESTS_PER_ACCOUNT,
  GENERIC_OTP_PUBLIC_RESPONSE,
} from "./otp";

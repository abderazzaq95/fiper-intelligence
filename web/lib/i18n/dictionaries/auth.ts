/* UI copy for the auth modal + /forgot-password + /auth/reset-password.
   Supabase's own error messages (signInError.message etc.) are English
   and pass through verbatim regardless of language — translating those
   would need a message-code mapping Supabase doesn't expose in a stable
   way, flagged explicitly rather than guessed at (see i18n summary). */

export const en = {
  modalTitle: 'Fiper Intelligence',
  close: 'Close',
  tabSignIn: 'Sign in',
  tabRegister: 'Create account',

  email: 'Email',
  emailPlaceholder: 'you@fiper.me',
  password: 'Password',
  confirmPassword: 'Confirm password',
  newPassword: 'New password',
  confirmNewPassword: 'Confirm new password',

  signInButton: 'Sign In',
  signingIn: 'Signing in…',
  forgotPassword: 'Forgot your password?',
  switchToRegister: "Don't have an account? Create one",

  createAccountButton: 'Create Account',
  creatingAccount: 'Creating account…',
  switchToSignIn: 'Already have an account? Sign in',
  passwordsNoMatch: 'Passwords do not match.',
  passwordTooShort: 'Password must be at least 8 characters.',
  checkEmailToConfirm: 'Check your email to confirm your account, then sign in.',

  forgotTitle: 'Reset Password',
  forgotSubtitle: "Enter your email and we'll send you a link to reset your password.",
  sendResetLink: 'Send Reset Link',
  sending: 'Sending…',
  backToSignIn: 'Back to sign in',
  resetLinkSent: 'If an account exists for that email, a reset link is on its way. Check your inbox.',

  resetTitle: 'Set New Password',
  resetSubtitle: 'Choose a new password for your account.',
  updatePassword: 'Update Password',
  updating: 'Updating…',
  verifyingLink: 'Verifying your reset link… if this link has expired, ',
  requestNewOne: 'request a new one',
};

export const ar: typeof en = {
  modalTitle: 'فايبر إنتليجنس',
  close: 'إغلاق',
  tabSignIn: 'تسجيل الدخول',
  tabRegister: 'إنشاء حساب',

  email: 'البريد الإلكتروني',
  emailPlaceholder: 'you@fiper.me',
  password: 'كلمة المرور',
  confirmPassword: 'تأكيد كلمة المرور',
  newPassword: 'كلمة المرور الجديدة',
  confirmNewPassword: 'تأكيد كلمة المرور الجديدة',

  signInButton: 'تسجيل الدخول',
  signingIn: 'جارٍ تسجيل الدخول…',
  forgotPassword: 'نسيت كلمة المرور؟',
  switchToRegister: 'ليس لديك حساب؟ أنشئ واحدًا',

  createAccountButton: 'إنشاء حساب',
  creatingAccount: 'جارٍ إنشاء الحساب…',
  switchToSignIn: 'لديك حساب بالفعل؟ سجّل الدخول',
  passwordsNoMatch: 'كلمتا المرور غير متطابقتين.',
  passwordTooShort: 'يجب أن تتكون كلمة المرور من 8 أحرف على الأقل.',
  checkEmailToConfirm: 'تحقق من بريدك الإلكتروني لتأكيد حسابك، ثم سجّل الدخول.',

  forgotTitle: 'إعادة تعيين كلمة المرور',
  forgotSubtitle: 'أدخل بريدك الإلكتروني وسنرسل لك رابطًا لإعادة تعيين كلمة المرور.',
  sendResetLink: 'إرسال رابط إعادة التعيين',
  sending: 'جارٍ الإرسال…',
  backToSignIn: 'العودة لتسجيل الدخول',
  resetLinkSent: 'إذا كان هناك حساب مرتبط بهذا البريد، فسيصلك رابط إعادة التعيين قريبًا. تحقق من بريدك الوارد.',

  resetTitle: 'تعيين كلمة مرور جديدة',
  resetSubtitle: 'اختر كلمة مرور جديدة لحسابك.',
  updatePassword: 'تحديث كلمة المرور',
  updating: 'جارٍ التحديث…',
  verifyingLink: 'جارٍ التحقق من رابط إعادة التعيين… إذا انتهت صلاحية هذا الرابط، ',
  requestNewOne: 'اطلب رابطًا جديدًا',
};

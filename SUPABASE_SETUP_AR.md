# تفعيل تسجيل Google والمزامنة في دليل آية V4

## 1) إنشاء مشروع Supabase
- أنشئ مشروعًا جديدًا في Supabase.
- من **SQL Editor** افتح ملف `supabase/schema.sql` الموجود داخل المشروع ونفّذه كاملًا.

## 2) تفعيل Google
- في Supabase: **Authentication → Providers → Google**.
- أنشئ OAuth Client من Google Cloud من نوع Web application.
- ضع Client ID وClient Secret داخل إعدادات Google في Supabase.
- أضف رابط الاستدعاء الذي يظهر لك في صفحة Google Provider داخل Supabase إلى **Authorized redirect URIs** في Google Cloud.

## 3) روابط إعادة التوجيه
في Supabase: **Authentication → URL Configuration**
- Site URL:
  `https://guideayah.vercel.app`
- Redirect URLs:
  `https://guideayah.vercel.app/**`

إذا تغير الدومين، أضف الدومين الجديد أيضًا.

## 4) متغيرات Vercel
في مشروع `guideayah`:
**Settings → Environment Variables**

أضف:
- `SUPABASE_URL` = رابط مشروع Supabase
- `SUPABASE_ANON_KEY` = المفتاح العام Publishable/Anon فقط

لا تضع `service_role` داخل Vercel لهذا التطبيق.

بعد الحفظ نفّذ **Redeploy**.

## 5) اختبار
- افتح التطبيق → المزيد → الحفظ والمزامنة.
- اضغط **المتابعة باستخدام Google**.
- بعد العودة للتطبيق يجب أن يظهر البريد وحالة **تمت المزامنة**.
- جرّب إضافة مذكرة ثم اضغط **مزامنة الآن**.

## ملاحظات
- البيانات النصية وإعدادات الحمل والمتابعة اليومية والمذكرات والمواعيد تتزامن.
- صور الذكريات تبقى محلية في هذه النسخة؛ تجهيز Supabase Storage يمكن إضافته لاحقًا.
- التطبيق يظل يعمل بالحفظ المحلي حتى لو لم يتم تفعيل Supabase أو انقطع الإنترنت.

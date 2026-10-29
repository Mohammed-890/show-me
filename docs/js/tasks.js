// Verified step guides for each task.
//
// Every step was written from the live GOV.UK / NHS / UKVI pages (captured
// October 2026). A step says how to recognise the screen (`signature`), what
// the person should press (`target`) and what to say to them. The engine never
// invents a button: it can only point at something a step names here.
//
// target.kind:
//   "button"  - a button or link whose text matches one of `phrases`
//   "input"   - the text box directly under a label matching `label`
//   "options" - a list of choices (radio buttons) matching `phrases`
//
// `require` (optional): at least one of these phrases must be on screen.
//
// `next` lets a step hand over to another step when the screen shows the
// current step is already done (for example, the postcode box is filled in).

export const LANGUAGES = [
  { code: 'en', name: 'English', voice: 'en-GB', dir: 'ltr' },
  { code: 'ar', name: 'العربية', voice: 'ar-SA', dir: 'rtl' },
  { code: 'ur', name: 'اردو', voice: 'ur-PK', dir: 'rtl' },
  { code: 'pl', name: 'Polski', voice: 'pl-PL', dir: 'ltr' },
];

// Steps that can appear inside any task.
const COOKIES = {
  id: 'cookies',
  signature: [['cookies on'], ['additional cookies'], ['analytics cookies'], ['reject all']],
  minSignature: 1,
  priority: 2,
  target: {
    kind: 'button',
    phrases: ['reject additional cookies', 'reject analytics cookies', 'reject all'],
  },
  say: {
    en: 'This box is about cookies. Tap “Reject”. It is the safe choice and the website still works.',
    ar: 'هذه الرسالة عن ملفات تعريف الارتباط (الكوكيز). اضغط على زر «Reject». هذا هو الخيار الآمن والموقع سيعمل بشكل طبيعي.',
    ur: 'یہ خانہ کوکیز کے بارے میں ہے۔ «Reject» والے بٹن کو دبائیں۔ یہ محفوظ انتخاب ہے اور ویب سائٹ پھر بھی چلے گی۔',
    pl: 'To okienko dotyczy plików cookie. Naciśnij „Reject”. To bezpieczny wybór, a strona nadal będzie działać.',
  },
};

const HUMAN_CHECK = {
  id: 'human_check',
  signature: [['confirm you are human'], ['security check'], ['not a bot']],
  minSignature: 1,
  priority: 2,
  target: { kind: 'button', phrases: ['begin'] },
  say: {
    en: 'This is a normal security check to stop robots. Tap “Begin” and follow the puzzle. If you get stuck, ask someone you trust to help.',
    ar: 'هذا فحص أمان عادي لمنع البرامج الآلية. اضغط على «Begin» واتبع اللغز. إذا واجهت صعوبة، اطلب المساعدة من شخص تثق به.',
    ur: 'یہ روبوٹس کو روکنے کے لیے ایک عام سیکیورٹی چیک ہے۔ «Begin» دبائیں اور پہیلی حل کریں۔ مشکل ہو تو کسی قابلِ بھروسہ شخص سے مدد لیں۔',
    pl: 'To zwykła kontrola bezpieczeństwa, która blokuje roboty. Naciśnij „Begin” i rozwiąż zagadkę. Jeśli utkniesz, poproś o pomoc zaufaną osobę.',
  },
};

export const TASKS = [
  {
    id: 'council-tax',
    icon: '🏠',
    title: {
      en: 'Check my Council Tax band',
      ar: 'معرفة فئة ضريبة المجلس لمنزلي',
      ur: 'اپنے گھر کا کونسل ٹیکس بینڈ دیکھیں',
      pl: 'Sprawdź pasmo podatku Council Tax',
    },
    startUrl: 'https://www.gov.uk/council-tax-bands',
    steps: [
      COOKIES,
      {
        id: 'start',
        signature: [['check your council tax band'], ['council tax'], ['valuation list']],
        minSignature: 1,
        target: { kind: 'button', phrases: ['start now'] },
        say: {
          en: 'Tap the green “Start now” button.',
          ar: 'اضغط على الزر الأخضر «Start now».',
          ur: 'سبز رنگ کا «Start now» بٹن دبائیں۔',
          pl: 'Naciśnij zielony przycisk „Start now”.',
        },
      },
      {
        id: 'enter_postcode',
        signature: [['search for a property'], ['enter a postcode']],
        minSignature: 2,
        target: { kind: 'input', label: 'enter a postcode' },
        next: 'search',
        say: {
          en: 'Tap the white box and type your postcode. For example: S1 1WB.',
          ar: 'اضغط على المربع الأبيض واكتب الرمز البريدي (Postcode) لعنوانك. مثال: S1 1WB.',
          ur: 'سفید خانے کو دبائیں اور اپنا پوسٹ کوڈ لکھیں۔ مثال: S1 1WB۔',
          pl: 'Naciśnij białe pole i wpisz swój kod pocztowy. Na przykład: S1 1WB.',
        },
      },
      {
        id: 'search',
        signature: [['search for a property'], ['enter a postcode']],
        minSignature: 2,
        hidden: true,
        target: { kind: 'button', phrases: ['search'], below: 'enter a postcode' },
        say: {
          en: 'Good, your postcode is in. Now tap “Search”. On the next screen, tap your address to see its band.',
          ar: 'ممتاز، كتبت الرمز البريدي. الآن اضغط على «Search». في الشاشة التالية اضغط على عنوانك لترى الفئة.',
          ur: 'بہت خوب، پوسٹ کوڈ لکھ دیا گیا۔ اب «Search» دبائیں۔ اگلی اسکرین پر اپنا پتہ دبائیں تاکہ بینڈ نظر آئے۔',
          pl: 'Dobrze, kod pocztowy jest wpisany. Teraz naciśnij „Search”. Na następnym ekranie naciśnij swój adres, aby zobaczyć pasmo.',
        },
      },
    ],
  },
  {
    id: 'gp-register',
    icon: '🩺',
    title: {
      en: 'Register with a GP',
      ar: 'التسجيل لدى طبيب عام (GP)',
      ur: 'جی پی (ڈاکٹر) کے ساتھ رجسٹر ہوں',
      pl: 'Zapisz się do lekarza rodzinnego (GP)',
    },
    startUrl: 'https://www.nhs.uk/nhs-services/gps/how-to-register-with-a-gp-surgery/',
    steps: [
      COOKIES,
      HUMAN_CHECK,
      {
        id: 'find_gp',
        signature: [['register with a gp surgery'], ['registration form'], ['nhs app']],
        minSignature: 2,
        target: { kind: 'button', phrases: ['find a gp to register with'] },
        say: {
          en: 'Do not use the blue NHS App buttons. Tap the link “Find a GP to register with”, next to the green arrow.',
          ar: 'لا تستخدم الأزرار الزرقاء الخاصة بتطبيق NHS. اضغط على الرابط «Find a GP to register with» بجانب السهم الأخضر.',
          ur: 'نیلے NHS App والے بٹن استعمال نہ کریں۔ سبز تیر کے ساتھ موجود لنک «Find a GP to register with» دبائیں۔',
          pl: 'Nie używaj niebieskich przycisków NHS App. Naciśnij link „Find a GP to register with” obok zielonej strzałki.',
        },
      },
      {
        id: 'enter_postcode',
        signature: [['find a gp'], ['enter a postcode in england'], ['use your location']],
        minSignature: 2,
        target: { kind: 'input', label: 'enter a postcode in england' },
        next: 'search',
        say: {
          en: 'Tap the white box and type the postcode where you live.',
          ar: 'اضغط على المربع الأبيض واكتب الرمز البريدي لمكان سكنك.',
          ur: 'سفید خانے کو دبائیں اور جہاں آپ رہتے ہیں وہاں کا پوسٹ کوڈ لکھیں۔',
          pl: 'Naciśnij białe pole i wpisz kod pocztowy miejsca, w którym mieszkasz.',
        },
      },
      {
        id: 'search',
        signature: [['find a gp'], ['enter a postcode in england'], ['use your location']],
        minSignature: 2,
        hidden: true,
        target: { kind: 'button', phrases: ['search'], below: 'enter a postcode in england' },
        say: {
          en: 'Good, your postcode is in. Now tap the green “Search” button.',
          ar: 'ممتاز، كتبت الرمز البريدي. الآن اضغط على الزر الأخضر «Search».',
          ur: 'بہت خوب، پوسٹ کوڈ لکھ دیا گیا۔ اب سبز «Search» بٹن دبائیں۔',
          pl: 'Dobrze, kod pocztowy jest wpisany. Teraz naciśnij zielony przycisk „Search”.',
        },
      },
      {
        id: 'choose_surgery',
        signature: [['gp surgeries near'], ['accepting new patients'], ['view gp surgery details']],
        minSignature: 1,
        target: { kind: 'button', phrases: ['register online with this gp'] },
        say: {
          en: 'These are GP surgeries near you. Look for one that says “Accepting new patients”, then tap “Register online with this GP”.',
          ar: 'هذه عيادات قريبة منك. ابحث عن عيادة مكتوب عليها «Accepting new patients» ثم اضغط «Register online with this GP».',
          ur: 'یہ آپ کے قریب جی پی سرجریز ہیں۔ وہ تلاش کریں جس پر «Accepting new patients» لکھا ہو، پھر «Register online with this GP» دبائیں۔',
          pl: 'To przychodnie w pobliżu. Znajdź taką z napisem „Accepting new patients” i naciśnij „Register online with this GP”.',
        },
      },
    ],
  },
  {
    id: 'evisa',
    icon: '🛂',
    title: {
      en: 'Get my eVisa share code',
      ar: 'الحصول على رمز المشاركة للتأشيرة الإلكترونية (eVisa)',
      ur: 'اپنے ای ویزا کا شیئر کوڈ حاصل کریں',
      pl: 'Uzyskaj kod udostępniania eVisa',
    },
    startUrl: 'https://www.gov.uk/view-prove-immigration-status',
    steps: [
      COOKIES,
      {
        id: 'open_service',
        signature: [['evisa'], ['share code'], ['ukvi account']],
        minSignature: 2,
        target: { kind: 'button', phrases: ['view your evisa and get a share code', 'view your evisa'] },
        say: {
          en: 'Tap the green button “View your eVisa and get a share code”. Have your passport or ID card ready.',
          ar: 'اضغط على الزر الأخضر «View your eVisa and get a share code». جهّز جواز سفرك أو بطاقة هويتك.',
          ur: 'سبز بٹن «View your eVisa and get a share code» دبائیں۔ اپنا پاسپورٹ یا شناختی کارڈ پاس رکھیں۔',
          pl: 'Naciśnij zielony przycisk „View your eVisa and get a share code”. Przygotuj paszport lub dowód osobisty.',
        },
      },
      {
        id: 'choose_document',
        signature: [['which identity document'], ['ukvi customer number'], ['national identity card']],
        require: ['which identity document', 'which identity document do you use'],
        minSignature: 2,
        target: {
          kind: 'options',
          phrases: ['passport', 'national identity card', 'biometric residence card or permit', 'i use a ukvi customer number'],
        },
        next: 'continue',
        say: {
          en: 'Choose the document you used when you made your UKVI account. Tap the circle next to it. Most people choose “Passport”.',
          ar: 'اختر الوثيقة التي استخدمتها عند إنشاء حساب UKVI. اضغط على الدائرة بجانبها. معظم الناس يختارون «Passport».',
          ur: 'وہ دستاویز منتخب کریں جو آپ نے UKVI اکاؤنٹ بناتے وقت استعمال کی تھی۔ اس کے ساتھ والے دائرے کو دبائیں۔ زیادہ تر لوگ «Passport» چنتے ہیں۔',
          pl: 'Wybierz dokument, którego użyłeś przy zakładaniu konta UKVI. Naciśnij kółko obok niego. Większość osób wybiera „Passport”.',
        },
      },
      {
        id: 'continue',
        signature: [['which identity document'], ['ukvi customer number'], ['national identity card']],
        require: ['which identity document', 'which identity document do you use'],
        minSignature: 2,
        hidden: true,
        target: { kind: 'button', phrases: ['continue'] },
        say: {
          en: 'Good, you have chosen your document. Now tap the green “Continue” button.',
          ar: 'ممتاز، اخترت الوثيقة. الآن اضغط على الزر الأخضر «Continue».',
          ur: 'بہت خوب، آپ نے دستاویز چن لی۔ اب سبز «Continue» بٹن دبائیں۔',
          pl: 'Dobrze, dokument jest wybrany. Teraz naciśnij zielony przycisk „Continue”.',
        },
      },
    ],
  },
];

// Fixed phrases used by the app around the step instructions.
export const UI = {
  scroll: {
    en: 'The button you need is further down. Scroll down a little, then take a new screenshot.',
    ar: 'الزر الذي تحتاجه في الأسفل. مرّر الشاشة إلى الأسفل قليلاً ثم التقط صورة شاشة جديدة.',
    ur: 'جس بٹن کی ضرورت ہے وہ نیچے ہے۔ تھوڑا نیچے اسکرول کریں، پھر نیا اسکرین شاٹ لیں۔',
    pl: 'Potrzebny przycisk jest niżej. Przewiń trochę w dół i zrób nowy zrzut ekranu.',
  },
  unknown: {
    en: 'I could not recognise this screen for this task. Check you are on the right website, or go back one page and take a new screenshot.',
    ar: 'لم أتمكن من التعرف على هذه الشاشة لهذه المهمة. تأكد أنك في الموقع الصحيح، أو ارجع صفحة واحدة والتقط صورة جديدة.',
    ur: 'میں اس کام کے لیے یہ اسکرین نہیں پہچان سکا۔ یقینی بنائیں کہ آپ درست ویب سائٹ پر ہیں، یا ایک صفحہ پیچھے جا کر نیا اسکرین شاٹ لیں۔',
    pl: 'Nie rozpoznaję tego ekranu dla tego zadania. Sprawdź, czy jesteś na właściwej stronie, albo wróć o jedną stronę i zrób nowy zrzut ekranu.',
  },
};

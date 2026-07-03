export type LandingLocale = "tr" | "en";

export const landingCopy = {
  tr: {
    nav: { workflow: "Akış", privacy: "Gizlilik", download: "İndir" },
    language: { label: "Dil seçimi", tr: "Türkçe", en: "English" },
    theme: { light: "Açık temaya geç", dark: "Koyu temaya geç" },
    hero: {
      eyebrow: "YEREL EKRAN GÖRÜNTÜSÜ AKIŞI",
      title: "Ekran görüntüsünü yakala, düzenle ve akışını bölmeden kullan.",
      description:
        "AtrisShot, ücretsiz Atris hesapları için hazırlanan Tauri masaüstü uygulamasıdır. Tek kısayolla odaklı pencereyi, mevcut ekranı veya çizdiğin bölgeyi yakala; resmi ya da kaydedilen path bilgisini doğrudan işine taşı.",
      primary: "İndir",
      secondary: "Akışı izle",
      update: "İmzalı güncelleme kanalı",
    },
    platform: {
      windows: "Windows için indir",
      linux: "Linux için indir",
      windowsDetail: "Windows 10/11 x64",
      linuxDetail: "AppImage / deb x64",
      macPaused: "macOS paketi Apple imzalama anahtarları hazır olduğunda eklenecek.",
    },
    highlights: ["Ücretsiz Atris hesabı", "Yerel geçmiş", "Panoya veya path olarak çıktı"],
    workflow: [
      ["Odaklı yakalama", "Aktif pencere veya ekran üzerinde çalış; ekran seçmekle uğraşma."],
      ["Bölge çiz", "Basılı tutup net bir alan seç, AtrisShot sadece o kısmı alır."],
      ["Düzenle", "Ok, kutu, kalem, metin, blur ve renk ayarlarıyla hızlı not düş."],
      ["Kullan", "Panoya resmi kopyala veya kaydedilen dosya path'ini çalışma alanına bırak."],
    ],
    privacy: {
      eyebrow: "YEREL VE KONTROLLÜ",
      title: "Görüntüler cihazında kalır.",
      description:
        "AtrisHub sadece giriş ve üyelik doğrulaması için kullanılır. Ekran görüntüleri, düzenleme geçmişi ve dosya yolları varsayılan olarak yerel uygulama verisidir.",
      cards: [
        ["AtrisHub girişi", "Free hesaplar ürüne erişebilir; Premium zorunluluğu yok."],
        ["Yerel dosyalar", "Geçmiş, önizleme ve kayıt klasörü cihazında yönetilir."],
        ["Hızlı paylaşım", "Resim ya da path çıktısı çalışma akışına saniyeler içinde geçer."],
      ],
    },
    download: {
      title: "AtrisShot'ı indir",
      description:
        "Yayınlar GitHub Release üzerinden gelir; public servis yalnızca landing, indirme yönlendirmesi ve Tauri updater metadata sağlar.",
      signed: "İmzalı updater yolu",
      free: "Free Atris hesabı ile kullanım",
      hub: "AtrisHub hesabını yönet",
    },
    film: {
      scenes: [
        ["Yakalamaya hazır", "Kısayola bas ve odaklı ekranın üzerinde seçime başla.", "Ctrl + Shift + S"],
        ["Net bölge seçimi", "Kesik çizgili overlay tam ekran gelir; tıkla veya basılı tutup alan çiz.", "Focused overlay"],
        ["Düzenleme araçları", "Ok, kutu, kalem, metin ve blur ile görseli hızlıca anlaşılır hale getir.", "Editor"],
        ["Çıktı hazır", "Panoya resmi kopyala, path'i taşı veya geçmişten tekrar aç.", "Clipboard + path"],
      ],
      footer: "Ücretsiz Atris hesabı için yerel ekran görüntüsü aracı",
      music: "Orijinal AtrisShot tanıtım teması",
    },
    footer: "Yerel-first ekran görüntüsü aracı · Atris ekosistemi",
  },
  en: {
    nav: { workflow: "Workflow", privacy: "Privacy", download: "Download" },
    language: { label: "Select language", tr: "Türkçe", en: "English" },
    theme: { light: "Switch to light theme", dark: "Switch to dark theme" },
    hero: {
      eyebrow: "LOCAL SCREENSHOT WORKFLOW",
      title: "Capture, edit, and place screenshots without breaking flow.",
      description:
        "AtrisShot is a Tauri desktop app for free Atris accounts. Use one shortcut to capture the focused window, current screen, or an exact dragged region, then copy the image or saved path into your work.",
      primary: "Download",
      secondary: "Watch workflow",
      update: "Signed update channel",
    },
    platform: {
      windows: "Download for Windows",
      linux: "Download for Linux",
      windowsDetail: "Windows 10/11 x64",
      linuxDetail: "AppImage / deb x64",
      macPaused: "macOS packages will return when Apple signing keys are ready.",
    },
    highlights: ["Free Atris account", "Local history", "Clipboard or path output"],
    workflow: [
      ["Focused capture", "Work over the active window or screen without choosing displays manually."],
      ["Draw a region", "Hold, drag, and capture the exact area you need."],
      ["Annotate", "Use arrows, rectangles, pen, text, blur, colors, and stroke controls."],
      ["Place output", "Copy the image or drag the saved path into your workflow."],
    ],
    privacy: {
      eyebrow: "LOCAL AND CONTROLLED",
      title: "Your screenshots stay on your device.",
      description:
        "AtrisHub is used for sign-in and membership verification only. Screenshots, edit history, and file paths remain local app data by default.",
      cards: [
        ["AtrisHub sign-in", "Free accounts can use the product; Premium is not required."],
        ["Local files", "History, previews, and save folders are managed on your device."],
        ["Fast sharing", "Image or path output moves into your workflow in seconds."],
      ],
    },
    download: {
      title: "Download AtrisShot",
      description:
        "Builds are delivered through GitHub Releases; the public service only serves landing, download routing, and Tauri updater metadata.",
      signed: "Signed updater path",
      free: "Free Atris account access",
      hub: "Manage AtrisHub account",
    },
    film: {
      scenes: [
        ["Ready to capture", "Press the shortcut and start selecting over the focused screen.", "Ctrl + Shift + S"],
        ["Precise region select", "A dashed full-screen overlay appears; click or hold and draw the area.", "Focused overlay"],
        ["Edit tools", "Use arrows, boxes, pen, text, and blur to make the screenshot clear fast.", "Editor"],
        ["Output ready", "Copy the image, move the path, or reopen it from local history.", "Clipboard + path"],
      ],
      footer: "A local screenshot tool for free Atris accounts",
      music: "Original AtrisShot promo theme",
    },
    footer: "Local-first screenshot tool · Atris ecosystem",
  },
} as const;

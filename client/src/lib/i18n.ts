/**
 * StoreOS — Ethiopian multilingual support
 * Default: English. Switchable to Amharic, Tigrinya, Oromiffa, Somali, Afar.
 * Usage:
 *   import { useLanguage, t } from '../lib/i18n';
 *   const { lang, setLang } = useLanguage();
 *   <h2>{t('dashboard', lang)}</h2>
 */

import { useState, useEffect } from 'react';

export type Lang = 'en' | 'am' | 'ti' | 'om' | 'so' | 'aa';

export const LANGUAGES: { code: Lang; label: string; native: string; flag: string }[] = [
  { code: 'en', label: 'English',   native: 'English',    flag: '🇬🇧' },
  { code: 'am', label: 'Amharic',   native: 'አማርኛ',      flag: '🇪🇹' },
  { code: 'ti', label: 'Tigrinya',  native: 'ትግርኛ',      flag: '🇪🇹' },
  { code: 'om', label: 'Oromiffa',  native: 'Afaan Oromoo', flag: '🇪🇹' },
  { code: 'so', label: 'Somali',    native: 'Soomaali',   flag: '🇪🇹' },
  { code: 'aa', label: 'Afar',      native: 'Qafár af',   flag: '🇪🇹' },
];

// All UI strings
type Translations = {
  // Navigation
  dashboard:     string; products:      string; inventory:     string;
  sales:         string; customers:     string; suppliers:     string;
  categories:    string; reports:       string; users:         string;
  traditional:   string;
  // Common actions
  add:           string; edit:          string; delete:        string;
  save:          string; cancel:        string; search:        string;
  export:        string; print:         string; filter:        string;
  // Products
  addProduct:    string; editProduct:   string; productName:   string;
  sku:           string; category:      string; supplier:      string;
  costPrice:     string; sellingPrice:  string; stock:         string;
  minStock:      string; status:        string; description:   string;
  barcode:       string; margin:        string; image:         string;
  // Stock statuses
  inStock:       string; lowStock:      string; outOfStock:    string;
  // Alerts
  stockAlert:    string; lowStockAlert: string; outOfStockAlert: string;
  stockThreshold: string;
  // Sales
  newSale:       string; invoice:       string; customer:      string;
  total:         string; cashier:       string; walkIn:        string;
  completeSale:  string; refund:        string;
  // Dashboard
  revenue:       string; profit:        string; todaySales:    string;
  inventoryValue: string; recentSales:  string; activityFeed:  string;
  // Misc
  noData:        string; loading:       string; confirm:       string;
  logOut:        string; allCategories: string; allStatuses:   string;
};

const T: Record<Lang, Translations> = {
  en: {
    dashboard: 'Dashboard',          products: 'Products',          inventory: 'Inventory',
    sales: 'Sales',                  customers: 'Customers',        suppliers: 'Suppliers',
    categories: 'Categories',        reports: 'Reports',            users: 'Users',
    traditional: 'Traditional Items',
    add: 'Add',                      edit: 'Edit',                  delete: 'Delete',
    save: 'Save',                    cancel: 'Cancel',              search: 'Search',
    export: 'Export',                print: 'Print',                filter: 'Filter',
    addProduct: 'Add Product',       editProduct: 'Edit Product',   productName: 'Product Name',
    sku: 'SKU',                      category: 'Category',          supplier: 'Supplier',
    costPrice: 'Cost Price',         sellingPrice: 'Selling Price', stock: 'Stock',
    minStock: 'Min Stock Level',     status: 'Status',              description: 'Description',
    barcode: 'Barcode / EAN',        margin: 'Margin',              image: 'Product Image',
    inStock: 'In Stock',             lowStock: 'Low Stock',         outOfStock: 'Out of Stock',
    stockAlert: 'Stock Alert',       lowStockAlert: 'Low Stock Alert', outOfStockAlert: 'Out of Stock!',
    stockThreshold: 'items remaining',
    newSale: 'New Sale',             invoice: 'Invoice',            customer: 'Customer',
    total: 'Total',                  cashier: 'Cashier',            walkIn: 'Walk-in',
    completeSale: 'Complete Sale',   refund: 'Refund',
    revenue: 'Revenue',              profit: 'Profit',              todaySales: "Today's Sales",
    inventoryValue: 'Inventory Value', recentSales: 'Recent Sales', activityFeed: 'Recent Activity',
    noData: 'No data found.',        loading: 'Loading…',           confirm: 'Are you sure?',
    logOut: 'Log out',               allCategories: 'All Categories', allStatuses: 'All Statuses',
  },
  am: {
    dashboard: 'ዳሽቦርድ',             products: 'ምርቶች',             inventory: 'ክምችት',
    sales: 'ሽያጮች',                  customers: 'ደንበኞች',            suppliers: 'አቅራቢዎች',
    categories: 'ምድቦች',             reports: 'ሪፖርቶች',            users: 'ተጠቃሚዎች',
    traditional: 'ባህላዊ እቃዎች',
    add: 'አስገባ',                     edit: 'አርም',                   delete: 'ሰርዝ',
    save: 'አስቀምጥ',                  cancel: 'ሰርዝ',                search: 'ፈልግ',
    export: 'ላክ',                    print: 'አትም',                  filter: 'ስም ጣሉ',
    addProduct: 'ምርት አስገባ',          editProduct: 'ምርት አርም',        productName: 'የምርት ስም',
    sku: 'የምርት ኮድ',                  category: 'ምድብ',               supplier: 'አቅራቢ',
    costPrice: 'የግዢ ዋጋ',             sellingPrice: 'የሽያጭ ዋጋ',      stock: 'ክምችት',
    minStock: 'ዝቅተኛ ክምችት',         status: 'ሁኔታ',                description: 'መግለጫ',
    barcode: 'ባርኮድ',                 margin: 'ትርፍ',                 image: 'የምርት ምስል',
    inStock: 'አለ',                   lowStock: 'ዝቅተኛ ክምችት',       outOfStock: 'አልቋል',
    stockAlert: 'የክምችት ማንቂያ',      lowStockAlert: 'ክምችት እያለቀ ነው', outOfStockAlert: 'ክምችት አልቋል!',
    stockThreshold: 'ዕቃ ቀርቷል',
    newSale: 'አዲስ ሽያጭ',             invoice: 'ደረሰኝ',              customer: 'ደንበኛ',
    total: 'ጠቅላላ',                  cashier: 'ካሸር',               walkIn: 'ያለ ምዝገባ',
    completeSale: 'ሽያጩን ጨርስ',       refund: 'ተመላሽ',
    revenue: 'ገቢ',                   profit: 'ትርፍ',                todaySales: 'የዛሬ ሽያጭ',
    inventoryValue: 'የክምችት ዋጋ',    recentSales: 'የቅርብ ሽያጮች',    activityFeed: 'ቅርብ እንቅስቃሴ',
    noData: 'ምንም ዳታ አልተገኘም።',      loading: 'እየጫነ ነው…',          confirm: 'እርግጠኛ ነዎት?',
    logOut: 'ውጣ',                   allCategories: 'ሁሉም ምድቦች',    allStatuses: 'ሁሉም ሁኔታዎች',
  },
  ti: {
    dashboard: 'ዳሽቦርድ',             products: 'ፍርያት',             inventory: 'ዕቑባ',
    sales: 'ሽያጥ',                   customers: 'ዓማዊል',            suppliers: 'ቕርቦ',
    categories: 'ምድባት',             reports: 'ጸብጻባት',            users: 'ተጠቀምቲ',
    traditional: 'ባህላዊ ኣቕሑ',
    add: 'ወስኽ',                     edit: 'ኣርም',                   delete: 'ሰርዝ',
    save: 'ዓቅብ',                    cancel: 'ሰርዝ',                search: 'ደሊ',
    export: 'ኣውጽእ',                print: 'ኣተሃትም',               filter: 'ኣጣርይ',
    addProduct: 'ፍርያት ወስኽ',         editProduct: 'ፍርያት ኣርም',      productName: 'ስም ፍርያት',
    sku: 'ኮድ',                       category: 'ምድብ',               supplier: 'ቕርቦ',
    costPrice: 'ዋጋ ምግዛእ',           sellingPrice: 'ዋጋ ሽያጥ',       stock: 'ዕቑባ',
    minStock: 'ዝቅ ዕቑባ',            status: 'ኩነታት',               description: 'መግለጺ',
    barcode: 'ባርኮድ',                margin: 'ረብሓ',                image: 'ስእሊ ፍርያት',
    inStock: 'ኣሎ',                   lowStock: 'ዝቅ ዕቑባ',          outOfStock: 'ወዲቑ',
    stockAlert: 'ጠቕላላ ዕቑባ',        lowStockAlert: 'ዕቑባ ቀሪቡ',    outOfStockAlert: 'ዕቑባ ወዲቑ!',
    stockThreshold: 'ዝተረፈ ዕቑባ',
    newSale: 'ሓድሽ ሽያጥ',            invoice: 'ደረሰኝ',              customer: 'ዓሚ',
    total: 'ጠቕላላ',                  cashier: 'ካሸር',               walkIn: 'ብዘይ ምዝገባ',
    completeSale: 'ሽያጥ ወድኣ',       refund: 'መልስ',
    revenue: 'እቶት',                  profit: 'ረብሓ',               todaySales: 'ሽያጥ ሎሚ',
    inventoryValue: 'ዋጋ ዕቑባ',      recentSales: 'ቀረብ ሽያጥ',      activityFeed: 'ቀረብ ምንቅስቓስ',
    noData: 'ዳታ ኣይተረኽበን።',         loading: 'ይጻዓን ኣሎ…',          confirm: 'ርግጸኛ ዲኻ?',
    logOut: 'ወጻኢ',                  allCategories: 'ኩሉ ምድባት',     allStatuses: 'ኩሉ ኩነታት',
  },
  om: {
    dashboard: 'Gabatee',             products: 'Meeshaalee',        inventory: 'Kuusaa',
    sales: 'Gurguurtaa',              customers: 'Maamiltoota',      suppliers: 'Dhiyeessitootaa',
    categories: 'Gosa',              reports: 'Gabaasaalee',        users: 'Fayyadamtootaa',
    traditional: 'Meeshaa Aadaa',
    add: 'Dabaluu',                   edit: 'Gulaali',               delete: 'Haquu',
    save: 'Ol kaa\'i',               cancel: 'Dhiibi',              search: 'Barbaadi',
    export: 'Erguu',                  print: 'Maxxansuu',            filter: 'Calaqsiisi',
    addProduct: 'Meeshaa Dabaluu',    editProduct: 'Meeshaa Gulaali', productName: 'Maqaa Meeshaa',
    sku: 'Koodii',                    category: 'Gosa',              supplier: 'Dhiyeessaa',
    costPrice: 'Gatii Bituu',         sellingPrice: 'Gatii Gurguruuf', stock: 'Kuusaa',
    minStock: 'Kuusaa Xiqqaa',        status: 'Haala',               description: 'Ibsa',
    barcode: 'Baarkoodii',            margin: 'Fayidaa',             image: 'Fakkii',
    inStock: 'Jira',                  lowStock: 'Xiqqaa',            outOfStock: 'Fixame',
    stockAlert: 'Beeksisa Kuusaa',   lowStockAlert: 'Kuusaan xiqqeessa jira', outOfStockAlert: 'Kuusaan fixame!',
    stockThreshold: 'hafuu',
    newSale: 'Gurguurtaa Haaraa',     invoice: 'Rasiidhaa',          customer: 'Maamilaa',
    total: 'Waligalaa',              cashier: 'Kaashiyar',          walkIn: 'Maamilaa Dhufe',
    completeSale: 'Gurguurtaa xumuruu', refund: 'Deebisuu',
    revenue: 'Galii',                 profit: 'Fayidaa',             todaySales: 'Gurguurtaa Har\'a',
    inventoryValue: 'Gatii Kuusaa',  recentSales: 'Gurguurtaa Dhiyoo', activityFeed: 'Sochii Dhiyoo',
    noData: 'Deetaan argamne.',       loading: 'Fe\'amaa jira…',     confirm: 'Mirkaneessitee?',
    logOut: 'Ba\'i',                 allCategories: 'Gosaalee Hunda', allStatuses: 'Haalaalee Hunda',
  },
  so: {
    dashboard: 'Diiwaangelinta',      products: 'Badeecadaha',       inventory: 'Kaydinta',
    sales: 'Iibka',                   customers: 'Macaamiisha',      suppliers: 'Qabta',
    categories: 'Qaybaha',           reports: 'Warbixinta',         users: 'Isticmaalayaasha',
    traditional: 'Waxyaabaha Dhaqanka',
    add: 'Kudar',                     edit: 'Tafatir',               delete: 'Tirtir',
    save: 'Kaydi',                    cancel: 'Jooji',               search: 'Raadi',
    export: 'Diri',                   print: 'Daabac',               filter: 'Shaandhee',
    addProduct: 'Badeecad Kudar',     editProduct: 'Badeecad Tafatir', productName: 'Magaca Badeecadda',
    sku: 'Lambarka',                  category: 'Qaybta',            supplier: 'Alaabada',
    costPrice: 'Qiimaha Iibsiga',    sellingPrice: 'Qiimaha Iibka', stock: 'Kaydi',
    minStock: 'Kaydinta Ugu Yar',     status: 'Xaalada',             description: 'Sharaxaad',
    barcode: 'Baarkoode',             margin: 'Faa\'iido',           image: 'Sawirka',
    inStock: 'Jiraa',                 lowStock: 'Yar',               outOfStock: 'Dhammaaday',
    stockAlert: 'Digniinta Kaydi',    lowStockAlert: 'Kaydinta waa yaraan', outOfStockAlert: 'Kaydinta dhammaaday!',
    stockThreshold: 'ayaa haray',
    newSale: 'Iib Cusub',             invoice: 'Rasiidka',           customer: 'Macmiil',
    total: 'Wadarta',                 cashier: 'Kaabiturka',         walkIn: 'Macmiil Cusub',
    completeSale: 'Dhamaystir Iibka', refund: 'Soo Celi',
    revenue: 'Dakhli',                profit: 'Faa\'iido',           todaySales: 'Iibka Maanta',
    inventoryValue: 'Qiimaha Kaydi', recentSales: 'Iib dhow',       activityFeed: 'Wixii dhacay',
    noData: 'Xog lama helin.',        loading: 'Wuu soo urursan…',   confirm: 'Ma hubtaa?',
    logOut: 'Ka bax',                allCategories: 'Dhammaan',      allStatuses: 'Dhammaan',
  },
  aa: {
    dashboard: 'Daashboord',          products: 'Xurma',             inventory: 'Koyta',
    sales: 'Timir',                   customers: 'Macaamiil',        suppliers: 'Siwa',
    categories: 'Qafila',            reports: 'Xabar',              users: 'Temarid',
    traditional: 'Adda Yoh',
    add: 'Ay',                        edit: 'Gar',                   delete: 'Ber',
    save: 'Koy',                      cancel: 'Nay',                 search: 'Bar',
    export: 'Sii',                    print: 'Daab',                 filter: 'Maqiis',
    addProduct: 'Xurma Ay',           editProduct: 'Xurma Gar',      productName: 'Xurma Tuk',
    sku: 'Kod',                       category: 'Qafila',            supplier: 'Siwa',
    costPrice: 'Gatii Bituu',         sellingPrice: 'Gatii Timiruu', stock: 'Koyta',
    minStock: 'Koyta Lac',            status: 'Haala',               description: 'Maqaam',
    barcode: 'Baarkod',               margin: 'Fayda',               image: 'Misil',
    inStock: 'Jira',                  lowStock: 'Lac',               outOfStock: 'Marra',
    stockAlert: 'Koyta Xabar',        lowStockAlert: 'Koyta lac jira', outOfStockAlert: 'Koyta marra!',
    stockThreshold: 'tefat',
    newSale: 'Timir Cusub',           invoice: 'Waraqad',            customer: 'Macmiil',
    total: 'Wadarta',                 cashier: 'Kaabitur',           walkIn: 'Macmiil',
    completeSale: 'Timir Dhamaystir', refund: 'Celi',
    revenue: 'Dakhli',                profit: 'Fayda',               todaySales: 'Timir Maanta',
    inventoryValue: 'Koyta Gatii',   recentSales: 'Timir dhow',     activityFeed: 'Wixii dhacay',
    noData: 'Xog lama helin.',        loading: 'Soo gurma…',         confirm: 'Hubtaa?',
    logOut: 'Ka bax',                allCategories: 'Dhammaan',      allStatuses: 'Dhammaan',
  },
};

export function t(key: keyof Translations, lang: Lang): string {
  return T[lang]?.[key] ?? T.en[key];
}

export function useLang() {
  const [lang, setLangState] = useState<Lang>(() => {
    return (localStorage.getItem('storeos-lang') as Lang) || 'en';
  });

  const setLang = (l: Lang) => {
    localStorage.setItem('storeos-lang', l);
    setLangState(l);
  };

  return { lang, setLang };
}

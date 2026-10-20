const fs = require('fs');
const path = require('path');

const rootDir = path.join(__dirname, '..');

// 1. UPDATE App.tsx
const appTsxPath = path.join(rootDir, 'App.tsx');
let appContent = fs.readFileSync(appTsxPath, 'utf8');

// Submit button in registration
appContent = appContent.replace(
  /submitButton:\s*\{\s*backgroundColor:\s*['"]#059669['"],/g,
  `submitButton: {\n    backgroundColor: '#FFA500',`
);
appContent = appContent.replace(
  /submitButtonText:\s*\{\s*color:\s*['"]#ffffff['"],/g,
  `submitButtonText: {\n    color: '#001F3F',`
);

// Detail call button
appContent = appContent.replace(
  /detailBottomCallBtn:\s*\{\s*flex:\s*1,\s*backgroundColor:\s*['"]#064e3b['"],/g,
  `detailBottomCallBtn: {\n    flex: 1,\n    backgroundColor: '#FFA500',`
);
appContent = appContent.replace(
  /detailBottomCallBtnText:\s*\{\s*fontSize:\s*12,\s*fontWeight:\s*['"]bold['"],\s*color:\s*['"]#ffffff['"]/g,
  `detailBottomCallBtnText: {\n    fontSize: 12,\n    fontWeight: '900',\n    color: '#001F3F'`
);

// SOS call button
appContent = appContent.replace(
  /sosWorkerCallBtn:\s*\{\s*backgroundColor:\s*['"]#064e3b['"],/g,
  `sosWorkerCallBtn: {\n    backgroundColor: '#FFA500',`
);
appContent = appContent.replace(
  /sosWorkerCallBtnText:\s*\{\s*color:\s*['"]#ffffff['"],/g,
  `sosWorkerCallBtnText: {\n    color: '#001F3F',`
);

// Empty button
appContent = appContent.replace(
  /emptyButton:\s*\{\s*backgroundColor:\s*['"]#059669['"],/g,
  `emptyButton: {\n    backgroundColor: '#FFA500',`
);
appContent = appContent.replace(
  /emptyButtonText:\s*\{\s*color:\s*['"]#ffffff['"],/g,
  `emptyButtonText: {\n    color: '#001F3F',`
);

// Form header
appContent = appContent.replace(
  /formHeader:\s*\{\s*backgroundColor:\s*['"]#064e3b['"],/g,
  `formHeader: {\n    backgroundColor: '#001F3F',`
);
appContent = appContent.replace(
  /formHeaderSubtitle:\s*\{\s*color:\s*['"]#a7f3d0['"],/g,
  `formHeaderSubtitle: {\n    color: '#FFD700',`
);

// Categories banner
appContent = appContent.replace(
  /categoriesBanner:\s*\{\s*backgroundColor:\s*['"]#064e3b['"],/g,
  `categoriesBanner: {\n    backgroundColor: '#001F3F',`
);
appContent = appContent.replace(
  /categoriesBannerSubtitle:\s*\{\s*color:\s*['"]#a7f3d0['"],/g,
  `categoriesBannerSubtitle: {\n    color: '#FFD700',`
);

// Rating modal
appContent = appContent.replace(
  /ratingModalHeader:\s*\{\s*backgroundColor:\s*['"]#064e3b['"],/g,
  `ratingModalHeader: {\n    backgroundColor: '#001F3F',`
);
appContent = appContent.replace(
  /ratingModalSubtitle:\s*\{\s*color:\s*['"]#a7f3d0['"],/g,
  `ratingModalSubtitle: {\n    color: '#FFD700',`
);
appContent = appContent.replace(
  /ratingSubmitBtn:\s*\{\s*flex:\s*1,\s*paddingVertical:\s*10,\s*borderRadius:\s*10,\s*backgroundColor:\s*['"]#064e3b['"],/g,
  `ratingSubmitBtn: {\n    flex: 1,\n    paddingVertical: 10,\n    borderRadius: 10,\n    backgroundColor: '#001F3F',`
);
appContent = appContent.replace(
  /profileActionBtn:\s*\{\s*backgroundColor:\s*['"]#064e3b['"],/g,
  `profileActionBtn: {\n    backgroundColor: '#001F3F',`
);
appContent = appContent.replace(
  /subRoleBtnActive:\s*\{\s*backgroundColor:\s*['"]#064e3b['"],\s*borderColor:\s*['"]#064e3b['"]/g,
  `subRoleBtnActive: {\n    backgroundColor: '#001F3F',\n    borderColor: '#001F3F'`
);
appContent = appContent.replace(
  /quickCityChipActive:\s*\{\s*backgroundColor:\s*['"]#064e3b['"],\s*borderColor:\s*['"]#064e3b['"]/g,
  `quickCityChipActive: {\n    backgroundColor: '#001F3F',\n    borderColor: '#001F3F'`
);

// Replaces any lingering #064e3b, #065f46, #059669
appContent = appContent.replace(/'#064e3b'/g, "'#001F3F'");
appContent = appContent.replace(/'#065f46'/g, "'#001F3F'");
appContent = appContent.replace(/'#059669'/g, "'#FFA500'");
appContent = appContent.replace(/'#047857'/g, "'#B45309'");
appContent = appContent.replace(/'#ecfdf5'/g, "'#FFF8E7'");
appContent = appContent.replace(/'#a7f3d0'/g, "'#FFE082'");
appContent = appContent.replace(/rgba\(6,\s*78,\s*59,\s*0\.2\)/g, "rgba(0, 31, 63, 0.15)");

fs.writeFileSync(appTsxPath, appContent, 'utf8');
console.log('✓ Updated App.tsx classic theme styling');

// 2. UPDATE src/components/AuthModal.tsx
const authPath = path.join(rootDir, 'src', 'components', 'AuthModal.tsx');
let authContent = fs.readFileSync(authPath, 'utf8');

// "Send Verification OTP" button: Vibrant Orange theme
authContent = authContent.replace(
  /className="w-full py-3 bg-\[#001F3F\] hover:bg-\[#002e5d\] active:bg-\[#00162e\] text-white text-xs font-bold rounded-xl shadow-md transition-all flex items-center justify-center gap-2 cursor-pointer disabled:opacity-60"/g,
  `className="w-full py-3 bg-[#FFA500] hover:bg-[#FF8C00] active:bg-[#e07b00] text-[#001F3F] text-xs font-black rounded-xl shadow-md transition-all flex items-center justify-center gap-2 cursor-pointer disabled:opacity-60"`
);

// OTP verify button
authContent = authContent.replace(
  /border-emerald-300 focus:bg-white focus:outline-none focus:ring-2 focus:ring-emerald-700/g,
  `border-[#FFA500] focus:bg-white focus:outline-none focus:ring-2 focus:ring-[#001F3F]`
);
authContent = authContent.replace(/text-emerald-700/g, 'text-[#001F3F]');
authContent = authContent.replace(/text-emerald-800/g, 'text-[#001F3F]');
authContent = authContent.replace(/bg-emerald-100/g, 'bg-amber-100');

fs.writeFileSync(authPath, authContent, 'utf8');
console.log('✓ Updated src/components/AuthModal.tsx');

// 3. UPDATE src/components/RegisterWorker.tsx
const regPath = path.join(rootDir, 'src', 'components', 'RegisterWorker.tsx');
let regContent = fs.readFileSync(regPath, 'utf8');

// Banner
regContent = regContent.replace(
  /bg-gradient-to-r from-emerald-900 to-emerald-800 text-white rounded-2xl p-4 shadow-sm relative overflow-hidden/g,
  `bg-[#001F3F] text-white rounded-2xl p-4 shadow-sm relative overflow-hidden border border-[#FFA500]/25`
);
regContent = regContent.replace(
  /bg-emerald-700\/80 border border-emerald-500\/40/g,
  `bg-[#002d5c] border border-amber-400/40`
);
regContent = regContent.replace(/text-emerald-200/g, 'text-[#FFD700]');

// Form card & inputs
regContent = regContent.replace(/border-emerald-900\/10/g, 'border-gray-200');
regContent = regContent.replace(/text-emerald-700/g, 'text-[#FFA500]');
regContent = regContent.replace(/text-emerald-800/g, 'text-[#001F3F]');
regContent = regContent.replace(/text-emerald-900/g, 'text-[#001F3F]');
regContent = regContent.replace(/text-emerald-950/g, 'text-[#001F3F]');
regContent = regContent.replace(/bg-emerald-50\/50/g, 'bg-amber-50/50');
regContent = regContent.replace(/bg-emerald-50\/80/g, 'bg-amber-50/80');
regContent = regContent.replace(/bg-emerald-50\/70/g, 'bg-amber-50/70');
regContent = regContent.replace(/bg-emerald-50\/30/g, 'bg-amber-50/30');
regContent = regContent.replace(/bg-emerald-50/g, 'bg-amber-50');
regContent = regContent.replace(/bg-emerald-100/g, 'bg-amber-100');
regContent = regContent.replace(/bg-emerald-200/g, 'bg-amber-200');
regContent = regContent.replace(/bg-emerald-600/g, 'bg-[#FFA500]');
regContent = regContent.replace(/border-emerald-100/g, 'border-amber-200');
regContent = regContent.replace(/border-emerald-200/g, 'border-amber-200');
regContent = regContent.replace(/border-emerald-300/g, 'border-amber-300');
regContent = regContent.replace(/border-emerald-600/g, 'border-[#FFA500]');
regContent = regContent.replace(/border-emerald-700\/30/g, 'border-[#FFA500]/30');
regContent = regContent.replace(/border-emerald-800/g, 'border-[#001F3F]');
regContent = regContent.replace(/border-emerald-950/g, 'border-[#001F3F]');
regContent = regContent.replace(/focus:ring-emerald-600/g, 'focus:ring-[#001F3F]');
regContent = regContent.replace(/hover:border-emerald-600/g, 'hover:border-[#FFA500]');
regContent = regContent.replace(/ring-emerald-700\/50/g, 'ring-amber-400/50');

// "Publish Free Profile" button: Vibrant Orange theme
regContent = regContent.replace(
  /className="w-full py-3\.5 px-4 bg-emerald-800 hover:bg-emerald-900 active:bg-emerald-950 text-white font-bold rounded-xl shadow-md text-sm flex items-center justify-center gap-2 cursor-pointer transition-all disabled:opacity-60"/g,
  `className="w-full py-3.5 px-4 bg-[#FFA500] hover:bg-[#FF8C00] active:bg-[#e07b00] text-[#001F3F] font-black rounded-xl shadow-lg text-sm flex items-center justify-center gap-2 cursor-pointer transition-all disabled:opacity-60"`
);

// Other buttons in RegisterWorker
regContent = regContent.replace(
  /bg-emerald-800 hover:bg-emerald-900/g,
  'bg-[#001F3F] hover:bg-[#002e5d]'
);
regContent = regContent.replace(/bg-emerald-800/g, 'bg-[#001F3F]');
regContent = regContent.replace(/hover:bg-emerald-100/g, 'hover:bg-amber-100');
regContent = regContent.replace(/hover:bg-emerald-50/g, 'hover:bg-amber-50');
regContent = regContent.replace(/hover:text-emerald-950/g, 'hover:text-[#001F3F]');
regContent = regContent.replace(/hover:text-emerald-900/g, 'hover:text-[#001F3F]');
regContent = regContent.replace(/hover:text-emerald-800/g, 'hover:text-[#001F3F]');
regContent = regContent.replace(/bg-\[#064e3b\]/g, 'bg-[#001F3F]');

fs.writeFileSync(regPath, regContent, 'utf8');
console.log('✓ Updated src/components/RegisterWorker.tsx');

// 4. UPDATE src/components/ProfileView.tsx
const profPath = path.join(rootDir, 'src', 'components', 'ProfileView.tsx');
let profContent = fs.readFileSync(profPath, 'utf8');

profContent = profContent.replace(
  /bg-gradient-to-r from-emerald-900 via-emerald-800 to-emerald-950/g,
  'bg-[#001F3F]'
);
profContent = profContent.replace(/border-emerald-900\/10/g, 'border-gray-200');
profContent = profContent.replace(/bg-emerald-700/g, 'bg-[#002b54]');
profContent = profContent.replace(/border-emerald-400\/40/g, 'border-[#FFA500]/50');
profContent = profContent.replace(/bg-emerald-600 hover:bg-emerald-500/g, 'bg-[#FFA500] hover:bg-[#FF8C00]');
profContent = profContent.replace(/text-emerald-300/g, 'text-[#FFD700]');
profContent = profContent.replace(/text-emerald-200/g, 'text-[#FFD700]');
profContent = profContent.replace(/bg-emerald-800\/80 text-emerald-200 border border-emerald-700/g, 'bg-[#002b54] text-[#FFD700] border border-[#FFA500]/40');
profContent = profContent.replace(/bg-emerald-50\/70 border-b border-emerald-100/g, 'bg-amber-50/50 border-b border-amber-200');
profContent = profContent.replace(/file:bg-emerald-800 file:text-white hover:file:bg-emerald-900/g, 'file:bg-[#001F3F] file:text-[#FFD700] hover:file:bg-[#002b54]');
profContent = profContent.replace(/bg-emerald-800 hover:bg-emerald-900/g, 'bg-[#001F3F] hover:bg-[#002b54]');
profContent = profContent.replace(/from-emerald-50 to-teal-50/g, 'from-amber-50 to-orange-50');
profContent = profContent.replace(/border-emerald-200/g, 'border-amber-200');
profContent = profContent.replace(/text-emerald-950/g, 'text-[#001F3F]');
profContent = profContent.replace(/text-emerald-900/g, 'text-[#001F3F]');
profContent = profContent.replace(/text-emerald-700/g, 'text-[#FFA500]');
profContent = profContent.replace(/text-emerald-800/g, 'text-[#001F3F]');
profContent = profContent.replace(/border-emerald-300/g, 'border-[#FFA500]');
profContent = profContent.replace(/bg-emerald-800/g, 'bg-[#001F3F]');
profContent = profContent.replace(/bg-emerald-100/g, 'bg-amber-100');

fs.writeFileSync(profPath, profContent, 'utf8');
console.log('✓ Updated src/components/ProfileView.tsx');

// 5. UPDATE src/App.tsx container
const srcAppPath = path.join(rootDir, 'src', 'App.tsx');
let srcAppContent = fs.readFileSync(srcAppPath, 'utf8');
srcAppContent = srcAppContent.replace(/bg-emerald-950\/5/g, 'bg-[#001F3F]/5');
srcAppContent = srcAppContent.replace(/border-emerald-950\/10/g, 'border-[#001F3F]/15');
fs.writeFileSync(srcAppPath, srcAppContent, 'utf8');
console.log('✓ Updated src/App.tsx');

console.log('✓ Classic Theme Restored Completely Across Web & Native!');

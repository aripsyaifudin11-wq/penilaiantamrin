import React, { useState } from 'react';
import {
  Activity,
  BookOpen,
  ClipboardList,
  Database,
  FileSpreadsheet,
  GitBranch,
  Home,
  LayoutDashboard,
  LogOut,
  Menu,
  Settings,
  Shield,
  Users,
  UserCheck,
  X,
} from 'lucide-react';
import { usePortal } from '../../services/portalContext';
import { LogoMark } from '../common/LogoMark';

export type AppRoute =
  | 'portal'
  | 'ustaz-dashboard'
  | 'ustaz-grading'
  | 'admin-login'
  | 'admin-dashboard'
  | 'admin-students'
  | 'admin-ustaz'
  | 'admin-subjects'
  | 'admin-assignments'
  | 'admin-monitoring'
  | 'admin-recap'
  | 'admin-settings';

interface AppShellProps {
  route: AppRoute;
  onNavigate: (route: AppRoute) => void;
  children: React.ReactNode;
}

interface AdminMenuGroup {
  group: string;
  items: { id: AppRoute; label: string; icon: React.ReactNode }[];
}

export function AppShell({ route, onNavigate, children }: AppShellProps) {
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const {
    settings,
    ustazSession,
    adminSession,
    isLiveFirestore,
    authUser,
    loginWithGoogle,
    logoutGoogle,
    logoutUstaz,
    logoutAdmin,
    isOnline,
  } = usePortal();

  const isAdminRoute = route.startsWith('admin-') && route !== 'admin-login';

  const adminMenuGroups: AdminMenuGroup[] = [
    {
      group: 'Ringkasan',
      items: [
        { id: 'admin-dashboard', label: 'Dashboard', icon: <LayoutDashboard className="w-[18px] h-[18px]" /> },
      ],
    },
    {
      group: 'Master Data',
      items: [
        { id: 'admin-students', label: 'Data Siswa', icon: <Users className="w-[18px] h-[18px]" /> },
        { id: 'admin-ustaz', label: 'Daftar Ustaz', icon: <UserCheck className="w-[18px] h-[18px]" /> },
        { id: 'admin-subjects', label: 'Data Mata Pelajaran', icon: <BookOpen className="w-[18px] h-[18px]" /> },
      ],
    },
    {
      group: 'Penilaian & Laporan',
      items: [
        { id: 'admin-assignments', label: 'Pemetaan Tugas Ustaz', icon: <GitBranch className="w-[18px] h-[18px]" /> },
        { id: 'admin-monitoring', label: 'Monitoring Penilaian', icon: <Activity className="w-[18px] h-[18px]" /> },
        { id: 'admin-recap', label: 'Rekap Nilai', icon: <FileSpreadsheet className="w-[18px] h-[18px]" /> },
        { id: 'admin-settings', label: 'Pengaturan', icon: <Settings className="w-[18px] h-[18px]" /> },
      ],
    },
  ];

  const handleNavClick = (target: AppRoute) => {
    onNavigate(target);
    setSidebarOpen(false);
  };

  return (
    <div className="min-h-screen bg-[#F6F8F7] flex flex-col">
      {/* Top Bar (Clean 3-Zone Contract) */}
      <header className="sticky top-0 z-30 bg-white/95 backdrop-blur-md border-b border-slate-200/85">
        <div
          className={`${
            isAdminRoute ? 'w-full' : 'max-w-7xl mx-auto'
          } px-4 sm:px-6 h-16 flex items-center justify-between gap-4 sm:gap-8`}
        >
          {/* Zone 1: Menu Trigger + Brand Wordmark */}
          <div className="flex items-center gap-3 min-w-0">
            <button
              type="button"
              aria-label={sidebarOpen ? 'Tutup menu navigasi' : 'Buka menu navigasi'}
              aria-expanded={sidebarOpen}
              onClick={() => setSidebarOpen((prev) => !prev)}
              className="min-h-[44px] min-w-[44px] rounded-xl border border-slate-200/90 bg-white hover:bg-slate-50 text-slate-700 flex items-center justify-center transition-colors shrink-0"
            >
              {sidebarOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
            </button>
            <button
              type="button"
              onClick={() => handleNavClick('portal')}
              className="flex items-center gap-2.5 text-left min-w-0 focus-visible:outline-2 focus-visible:outline-emerald-700 rounded-xl"
            >
              <LogoMark src={settings.logoUrl} alt={settings.schoolName} sizeClass="w-9 h-9" />
              <span className="font-display font-bold text-slate-900 tracking-tight text-base sm:text-lg whitespace-nowrap shrink-0">
                PORTAL PENILAIAN
              </span>
            </button>
          </div>

          {/* Zone 2: Clean Typographic Context Links (Desktop) */}
          <nav className="hidden md:flex items-center gap-6 text-sm font-medium text-slate-600">
            <button
              type="button"
              onClick={() => handleNavClick('portal')}
              className={`py-1.5 border-b-2 transition-colors whitespace-nowrap shrink-0 ${
                route === 'portal'
                  ? 'border-emerald-700 text-emerald-800 font-semibold'
                  : 'border-transparent hover:text-slate-900'
              }`}
            >
              Portal Ustaz
            </button>
            {ustazSession && (
              <button
                type="button"
                onClick={() => handleNavClick('ustaz-dashboard')}
                className={`py-1.5 border-b-2 transition-colors whitespace-nowrap shrink-0 ${
                  route === 'ustaz-dashboard' || route === 'ustaz-grading'
                    ? 'border-emerald-700 text-emerald-800 font-semibold'
                    : 'border-transparent hover:text-slate-900'
                }`}
              >
                Tugas {ustazSession.ustazName}
              </button>
            )}
            {adminSession && !adminSession.mustChangePassword && (
              <button
                type="button"
                onClick={() => handleNavClick('admin-dashboard')}
                className={`py-1.5 border-b-2 transition-colors whitespace-nowrap shrink-0 ${
                  isAdminRoute
                    ? 'border-emerald-700 text-emerald-800 font-semibold'
                    : 'border-transparent hover:text-slate-900'
                }`}
              >
                Panel Admin
              </button>
            )}
          </nav>

          {/* Zone 3: Single Primary Contextual Action */}
          <div className="flex items-center gap-2.5 shrink-0">
            {!isOnline && (
              <span className="text-xs font-semibold text-amber-800 px-2.5 py-1 rounded-lg bg-amber-50 border border-amber-200 whitespace-nowrap">
                Offline
              </span>
            )}
            <button
              type="button"
              onClick={() =>
                handleNavClick(
                  adminSession && !adminSession.mustChangePassword ? 'admin-dashboard' : 'admin-login'
                )
              }
              className="min-h-[44px] px-4 rounded-xl bg-emerald-800 hover:bg-emerald-900 text-white font-semibold text-sm inline-flex items-center gap-2 transition-colors whitespace-nowrap shrink-0 shadow-xs"
            >
              <Shield className="w-4 h-4 text-[#E5C97B]" />
              <span>{adminSession && !adminSession.mustChangePassword ? 'Admin' : 'Login Admin'}</span>
            </button>
          </div>
        </div>
      </header>

      {/* Collapsible Sidebar Drawer */}
      {sidebarOpen && (
        <div className="fixed inset-0 z-40 flex">
          <div
            aria-hidden="true"
            onClick={() => setSidebarOpen(false)}
            className="fixed inset-0 bg-slate-950/45 backdrop-blur-xs"
          />
          <aside
            aria-label="Menu navigasi utama"
            className="relative z-50 w-80 max-w-[86vw] bg-white border-r border-slate-200 h-full flex flex-col shadow-2xl"
          >
            <div className="p-5 bg-[#064E3B] text-white flex items-center justify-between gap-3">
              <div className="flex items-center gap-3 min-w-0">
                <LogoMark src={settings.logoUrl} alt={settings.schoolName} sizeClass="w-10 h-10" framed />
                <div className="min-w-0">
                  <p className="font-display font-bold text-white text-sm truncate">PORTAL PENILAIAN</p>
                  <p className="text-xs text-emerald-100/80 truncate">Ma&apos;hadul Muta&apos;allimin I</p>
                </div>
              </div>
              <button
                type="button"
                aria-label="Tutup sidebar"
                onClick={() => setSidebarOpen(false)}
                className="min-h-[44px] min-w-[44px] rounded-xl text-emerald-100 hover:bg-white/10 flex items-center justify-center"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <nav className="flex-1 overflow-y-auto p-4 space-y-5">
              <div className="space-y-1">
                <p className="px-3 py-1 text-xs font-semibold text-slate-400">
                  Portal Ustaz
                </p>
                <button
                  type="button"
                  onClick={() => handleNavClick('portal')}
                  className={`w-full min-h-[48px] px-3.5 rounded-xl flex items-center gap-3 text-left font-medium text-base transition-colors ${
                    route === 'portal'
                      ? 'bg-emerald-800 text-white shadow-xs'
                      : 'text-slate-700 hover:bg-slate-100'
                  }`}
                >
                  <Home className="w-5 h-5 shrink-0" />
                  <span>Pilih Nama Ustaz</span>
                </button>

                {ustazSession && (
                  <button
                    type="button"
                    onClick={() => handleNavClick('ustaz-dashboard')}
                    className={`w-full min-h-[48px] px-3.5 rounded-xl flex items-center gap-3 text-left font-medium text-base transition-colors ${
                      route === 'ustaz-dashboard' || route === 'ustaz-grading'
                        ? 'bg-emerald-800 text-white shadow-xs'
                        : 'text-slate-700 hover:bg-slate-100'
                    }`}
                  >
                    <ClipboardList className="w-5 h-5 shrink-0" />
                    <span>Tugas Saya</span>
                  </button>
                )}
              </div>

              <div className="pt-4 border-t border-slate-200/80 space-y-4">
                {adminSession && !adminSession.mustChangePassword ? (
                  adminMenuGroups.map((grp) => (
                    <div key={grp.group} className="space-y-1">
                      <p className="px-3 py-1 text-xs font-semibold text-slate-400">{grp.group}</p>
                      {grp.items.map((item) => (
                        <button
                          key={item.id}
                          type="button"
                          onClick={() => handleNavClick(item.id)}
                          className={`w-full min-h-[46px] px-3.5 rounded-xl flex items-center gap-3 text-left font-medium text-sm transition-colors ${
                            route === item.id
                              ? 'bg-emerald-800 text-white shadow-xs'
                              : 'text-slate-700 hover:bg-slate-100'
                          }`}
                        >
                          {item.icon}
                          <span>{item.label}</span>
                        </button>
                      ))}
                    </div>
                  ))
                ) : (
                  <div className="space-y-1">
                    <p className="px-3 py-1 text-xs font-semibold text-slate-400">Administrasi</p>
                    <button
                      type="button"
                      onClick={() => handleNavClick('admin-login')}
                      className={`w-full min-h-[48px] px-3.5 rounded-xl flex items-center gap-3 text-left font-medium text-base transition-colors ${
                        route === 'admin-login'
                          ? 'bg-emerald-800 text-white shadow-xs'
                          : 'text-slate-700 hover:bg-slate-100'
                      }`}
                    >
                      <Shield className="w-5 h-5 shrink-0" />
                      <span>Masuk sebagai Admin</span>
                    </button>
                  </div>
                )}
              </div>
            </nav>

            <div className="p-4 border-t border-slate-200/80 space-y-2 bg-slate-50/70">
              {!isLiveFirestore ? (
                <button
                  type="button"
                  onClick={loginWithGoogle}
                  className="w-full min-h-[48px] px-4 rounded-xl bg-white border border-slate-300 hover:bg-slate-100 text-slate-800 font-semibold text-sm flex items-center justify-center gap-2 transition-colors"
                >
                  <Database className="w-4 h-4 text-emerald-700 shrink-0" />
                  <span className="whitespace-nowrap">Hubungkan Google Firestore</span>
                </button>
              ) : (
                <div className="space-y-2">
                  <p className="text-xs text-emerald-800 font-semibold truncate px-1">
                    Firestore Live · {authUser?.email}
                  </p>
                  <button
                    type="button"
                    onClick={logoutGoogle}
                    className="w-full min-h-[44px] px-4 rounded-xl border border-slate-300 bg-white hover:bg-slate-100 text-slate-700 font-medium text-sm flex items-center justify-center gap-2"
                  >
                    <LogOut className="w-4 h-4" />
                    <span>Putuskan Sesi Google</span>
                  </button>
                </div>
              )}

              {ustazSession && (
                <button
                  type="button"
                  onClick={() => {
                    logoutUstaz();
                    handleNavClick('portal');
                  }}
                  className="w-full min-h-[44px] px-4 rounded-xl text-red-700 hover:bg-red-50 font-medium text-sm flex items-center justify-center gap-2"
                >
                  <LogOut className="w-4 h-4" />
                  <span>Keluar Sesi Ustaz</span>
                </button>
              )}

              {adminSession && (
                <button
                  type="button"
                  onClick={() => {
                    logoutAdmin();
                    handleNavClick('portal');
                  }}
                  className="w-full min-h-[44px] px-4 rounded-xl text-red-700 hover:bg-red-50 font-medium text-sm flex items-center justify-center gap-2"
                >
                  <LogOut className="w-4 h-4" />
                  <span>Keluar Admin</span>
                </button>
              )}
            </div>
          </aside>
        </div>
      )}

      {/* Main Layout Container + Desktop Persistent Admin Sidebar */}
      <div className={`flex-1 flex w-full ${isAdminRoute ? '' : 'max-w-7xl mx-auto'}`}>
        {isAdminRoute && (
          <aside
            aria-label="Sidebar Admin"
            className="hidden lg:flex flex-col w-[272px] shrink-0 bg-white border-r border-slate-200/85 p-4 gap-5"
          >
            <div className="px-3.5 py-3 rounded-2xl bg-[#F0F7F4] border border-emerald-200/70">
              <p className="text-xs font-semibold text-emerald-800">Panel Administrasi</p>
              <p className="text-sm font-bold text-slate-900 truncate mt-0.5">{adminSession?.name || 'Administrator'}</p>
            </div>

            <div className="space-y-5 flex-1">
              {adminMenuGroups.map((grp) => (
                <div key={grp.group} className="space-y-1">
                  <p className="px-3 text-xs font-semibold text-slate-400">{grp.group}</p>
                  {grp.items.map((item) => (
                    <button
                      key={item.id}
                      type="button"
                      onClick={() => onNavigate(item.id)}
                      className={`w-full min-h-[44px] px-3.5 rounded-xl flex items-center gap-3 text-left font-medium text-sm transition-colors ${
                        route === item.id
                          ? 'bg-emerald-800 text-white shadow-xs'
                          : 'text-slate-700 hover:bg-slate-100'
                      }`}
                    >
                      <span className="shrink-0">{item.icon}</span>
                      <span className="whitespace-nowrap">{item.label}</span>
                    </button>
                  ))}
                </div>
              ))}
            </div>

            <div className="pt-4 border-t border-slate-200/80 space-y-2">
              {!isLiveFirestore ? (
                <button
                  type="button"
                  onClick={loginWithGoogle}
                  className="w-full min-h-[44px] px-3.5 rounded-xl border border-emerald-200 bg-emerald-50 hover:bg-emerald-100 text-emerald-900 font-semibold text-xs flex items-center justify-center gap-2 transition-colors"
                >
                  <Database className="w-4 h-4 shrink-0" />
                  <span className="whitespace-nowrap">Hubungkan Google Firestore</span>
                </button>
              ) : (
                <p className="text-xs text-emerald-800 font-medium px-2 truncate">
                  Terhubung · {authUser?.email}
                </p>
              )}
              <button
                type="button"
                onClick={() => {
                  logoutAdmin();
                  onNavigate('portal');
                }}
                className="w-full min-h-[44px] px-3.5 rounded-xl text-red-700 hover:bg-red-50 font-medium text-sm flex items-center gap-2 transition-colors"
              >
                <LogOut className="w-4 h-4 shrink-0" />
                <span>Keluar Admin</span>
              </button>
            </div>
          </aside>
        )}

        <main className="flex-1 min-w-0 p-4 sm:p-6 lg:p-8">{children}</main>
      </div>
    </div>
  );
}

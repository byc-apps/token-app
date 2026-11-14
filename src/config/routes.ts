const segment = (value: string) => encodeURIComponent(value);

export const routes = {
  home: "/",
  login: "/login",
  profile: "/profile",
  completeProfile: "/complete-profile",
  book: "/book",
  token: (id: string) => `/tokens/${segment(id)}`,
  console: (centreId: string) => `/console/${segment(centreId)}`,
  display: (centreId: string) => `/console/${segment(centreId)}/display`,
  centreSetup: (centreId: string) => `/centres/${segment(centreId)}/setup`,
  centreStaff: (centreId: string) => `/centres/${segment(centreId)}/staff`,
  centreReports: (centreId: string) => `/centres/${segment(centreId)}/reports`,
  users: "/admin/users",
  centres: "/admin/centres",
  settings: "/admin/settings",
  reports: "/admin/reports",
  logs: "/admin/logs",
  styleguide: "/styleguide",
};

const EN: Record<string, string> = {
  // common
  "common.loading": "Loading…",
  "common.save": "Save",
  "common.cancel": "Cancel",
  "common.refresh": "Refresh",
  "common.logout": "Log out",
  "common.light": "Light",
  "common.dark": "Dark",

  // brand/top
  "brand.name": "Sales Genius",
  "brand.sub": "Control panel",
  "top.project": "Project",
  "top.theme": "Theme",

  // login
  "login.title": "Sign in",
  "login.tab.login": "Login",
  "login.tab.register": "Register",
  "login.email": "Email",
  "login.password": "Password",
  "login.name": "Name",
  "login.submit.login": "Sign in",
  "login.submit.register": "Create account",

  "login.progress.signin": "Signing in…",
"login.progress.register": "Creating account…",
"login.progress.openCabinet": "Done. Opening cabinet…",

"err.EMAIL_EXISTS": "This email is already registered. Try signing in.",
"err.BAD_EMAIL": "Invalid email.",
"err.WEAK_PASSWORD": "Password is too short.",
"err.BAD_CREDENTIALS": "Wrong email or password.",
"err.EMAIL_OR_PASSWORD_MISSING": "Enter email and password.",
"err.BAD_INPUT": "Check email and password (password must be at least 6 characters).",
"err.EMAIL_NOT_VERIFIED": "Email is not verified yet.",
"err.GENERIC": "Error: {code}",
"err.UNKNOWN": "Error",


  // cabinet/projects
  "cabinet.title": "Projects",
  "cabinet.newProject": "Create project",
  "cabinet.projectName": "Mini-app name",
  "cabinet.open": "Open",
  "cabinet.empty": "No projects yet — create your first one.",

  // nav (panel)
  "nav.overview": "Overview",
  "nav.live": "Live",
  "nav.customers": "Customers",
  "nav.sales": "Sales",
  "nav.wheel": "Wheel",
  "nav.passport": "Passport",
  "nav.calendar": "Calendar",
  "nav.profit": "Profit / ROI",
  "nav.settings": "Settings",
  "nav.constructor": "Constructor",
  "nav.game": "Game",
  "nav.referrals": "Referrals",
  "nav.broadcasts": "Broadcasts",



  // severity
"sev.ok": "OK",
"sev.risk": "RISK",
"sev.bad": "BAD",

// overview texts
"ov.title": "Overview",
"ov.subtitle": "Main dashboard: sales, customers, loyalty, alerts.",
"ov.range": "Range",
"ov.dynamics": "Dynamics",
"ov.chartType": "Chart type",
"ov.chart.bars": "Bars",
"ov.chart.line": "Line",
"ov.chart.area": "Area",
"ov.pickProject": "Select a project.",
"ov.error": "Error: {msg}",

"ov.metric.sales": "Sales",
"ov.metric.customers": "Customers",
"ov.metric.loyalty": "Loyalty",
"ov.metric.funnel": "Funnel",
"ov.metric.qrScans": "QR scans",

"ov.kpi.revenue": "Revenue",
"ov.kpi.checks": "Checks",
"ov.kpi.avgCheck": "Avg check",
"ov.kpi.coinsIssued": "Coins issued",
"ov.kpi.coinsRedeemed": "Coins redeemed",
"ov.kpi.redeemRate": "Redeem rate",
"ov.kpi.newCustomers": "New",
"ov.kpi.activeCustomers": "Active",
"ov.kpi.hint.period": "for the period",

"ov.live": "Live",
"ov.alerts": "Alerts",
"ov.liveFeed": "Live feed",
"ov.liveFeedSub": "latest events",
"ov.refreshing": "refreshing…",
"ov.ready": "ready",
"ov.empty": "Nothing yet.",

"ov.alertsTitle": "Alerts & insights",
"ov.alertsSub": "what needs attention",
"ov.items": "{n} items",
"ov.items0": "0 items",
"ov.noAlerts": "No alerts. All good.",

"ov.quickActions": "Quick actions",
"ov.action.sendMessage": "Send message",
"ov.action.createPromo": "Create promo",
"ov.action.cashbackSettings": "Cashback settings",
"ov.tip": "Tip",
"ov.tipText": "Start with a winback for customers who haven't visited for 14+ days.",

"ov.top": "Top",
"ov.top.customers": "Customers",
"ov.top.prizes": "Prizes",
"ov.top.cashiers": "Cashiers",
"ov.noData": "No data.",
"ov.redeemed": "redeemed",

"ov.health": "Health",
"ov.liabilityCoins": "Liability (coins)",




    "cust.subtitle": "Search users and chat like dialogs.",
  "cust.mode.users": "Users",
  "cust.mode.dialogs": "Dialogs",
  "cust.range.today": "Today",
  "cust.range.7d": "7d",
  "cust.range.30d": "30d",
  "cust.range.all": "All",
  "cust.searchUsers": "Search: tg id / @username …",
  "cust.searchDialogsHint": "Dialogs are filtered by range (search via users list).",
  "cust.people": "People",
  "cust.dialogs": "Dialogs",
  "cust.found": "{n} found",
  "cust.empty": "Nothing found.",
  "cust.pick": "Select a user",
  "cust.pickHint": "Pick a user on the left — chat opens here.",
  "cust.noMessages": "No messages yet.",
  "cust.typeMessage": "Type a message…",
  "cust.send": "Send",
  "cust.tipCtrlEnter": "Tip: Ctrl+Enter to send",
  "cust.lastSeen": "Last seen",

  "bc.subtitle": "Campaigns, broadcasts and KPIs.",
  "bc.search": "Search campaigns…",
  "bc.create": "Create broadcast",
  "bc.campaigns": "Campaigns",
  "bc.count": "{n} campaigns",
  "bc.empty": "No campaigns yet. Click “Create broadcast”.",
  "bc.untitled": "Untitled",
  "bc.segment": "Segment",
  "bc.status": "Status",
  "bc.kpi": "KPI",
  "bc.kpiSub": "Summary across campaigns",
  "bc.kpi.campaigns": "Campaigns",
  "bc.kpi.done": "Done",
  "bc.kpi.sent": "Sent",
  "bc.kpi.failRate": "Fail rate",
  "bc.selected": "Selected",
  "bc.pick": "Pick a campaign on the left",
  "bc.updated": "Updated",

  "bc.drawer.title": "New broadcast",
  "bc.drawer.sub": "Write the text, then send",
  "bc.drawer.campaignTitle": "Title",
  "bc.drawer.titlePh": "e.g. Coffee discount today",
  "bc.drawer.segment": "Segment",
  "bc.drawer.text": "Text",
  "bc.drawer.textPh": "Message…",
  "bc.drawer.btnText": "Button text",
  "bc.drawer.btnUrl": "Button URL",
  "bc.drawer.preview": "Preview",
  "bc.drawer.button": "Button",
  "bc.drawer.send": "Send",


};

export default EN;




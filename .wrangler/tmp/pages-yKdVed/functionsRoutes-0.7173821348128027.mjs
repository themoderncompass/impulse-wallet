import { onRequestGet as __impulse_api_events_js_onRequestGet } from "/Users/josh/Documents/GitHub/impulse-wallet/functions/impulse-api/events.js"
import { onRequestPost as __impulse_api_events_js_onRequestPost } from "/Users/josh/Documents/GitHub/impulse-wallet/functions/impulse-api/events.js"
import { onRequestGet as __impulse_api_focus_js_onRequestGet } from "/Users/josh/Documents/GitHub/impulse-wallet/functions/impulse-api/focus.js"
import { onRequestPost as __impulse_api_focus_js_onRequestPost } from "/Users/josh/Documents/GitHub/impulse-wallet/functions/impulse-api/focus.js"
import { onRequestGet as __impulse_api_health_js_onRequestGet } from "/Users/josh/Documents/GitHub/impulse-wallet/functions/impulse-api/health.js"
import { onRequestPost as __impulse_api_init_db_js_onRequestPost } from "/Users/josh/Documents/GitHub/impulse-wallet/functions/impulse-api/init-db.js"
import { onRequestGet as __impulse_api_room_js_onRequestGet } from "/Users/josh/Documents/GitHub/impulse-wallet/functions/impulse-api/room.js"
import { onRequestPost as __impulse_api_room_js_onRequestPost } from "/Users/josh/Documents/GitHub/impulse-wallet/functions/impulse-api/room.js"
import { onRequestGet as __impulse_api_room_leave_js_onRequestGet } from "/Users/josh/Documents/GitHub/impulse-wallet/functions/impulse-api/room-leave.js"
import { onRequestPost as __impulse_api_room_leave_js_onRequestPost } from "/Users/josh/Documents/GitHub/impulse-wallet/functions/impulse-api/room-leave.js"
import { onRequestGet as __impulse_api_room_manage_js_onRequestGet } from "/Users/josh/Documents/GitHub/impulse-wallet/functions/impulse-api/room-manage.js"
import { onRequestPost as __impulse_api_room_manage_js_onRequestPost } from "/Users/josh/Documents/GitHub/impulse-wallet/functions/impulse-api/room-manage.js"
import { onRequestGet as __impulse_api_room_suggestions_js_onRequestGet } from "/Users/josh/Documents/GitHub/impulse-wallet/functions/impulse-api/room-suggestions.js"
import { onRequestPost as __impulse_api_room_suggestions_js_onRequestPost } from "/Users/josh/Documents/GitHub/impulse-wallet/functions/impulse-api/room-suggestions.js"
import { onRequestDelete as __impulse_api_state_js_onRequestDelete } from "/Users/josh/Documents/GitHub/impulse-wallet/functions/impulse-api/state.js"
import { onRequestGet as __impulse_api_state_js_onRequestGet } from "/Users/josh/Documents/GitHub/impulse-wallet/functions/impulse-api/state.js"
import { onRequestPost as __impulse_api_state_js_onRequestPost } from "/Users/josh/Documents/GitHub/impulse-wallet/functions/impulse-api/state.js"
import { onRequestGet as __impulse_api_user_js_onRequestGet } from "/Users/josh/Documents/GitHub/impulse-wallet/functions/impulse-api/user.js"
import { onRequestPost as __impulse_api_user_js_onRequestPost } from "/Users/josh/Documents/GitHub/impulse-wallet/functions/impulse-api/user.js"

export const routes = [
    {
      routePath: "/impulse-api/events",
      mountPath: "/impulse-api",
      method: "GET",
      middlewares: [],
      modules: [__impulse_api_events_js_onRequestGet],
    },
  {
      routePath: "/impulse-api/events",
      mountPath: "/impulse-api",
      method: "POST",
      middlewares: [],
      modules: [__impulse_api_events_js_onRequestPost],
    },
  {
      routePath: "/impulse-api/focus",
      mountPath: "/impulse-api",
      method: "GET",
      middlewares: [],
      modules: [__impulse_api_focus_js_onRequestGet],
    },
  {
      routePath: "/impulse-api/focus",
      mountPath: "/impulse-api",
      method: "POST",
      middlewares: [],
      modules: [__impulse_api_focus_js_onRequestPost],
    },
  {
      routePath: "/impulse-api/health",
      mountPath: "/impulse-api",
      method: "GET",
      middlewares: [],
      modules: [__impulse_api_health_js_onRequestGet],
    },
  {
      routePath: "/impulse-api/init-db",
      mountPath: "/impulse-api",
      method: "POST",
      middlewares: [],
      modules: [__impulse_api_init_db_js_onRequestPost],
    },
  {
      routePath: "/impulse-api/room",
      mountPath: "/impulse-api",
      method: "GET",
      middlewares: [],
      modules: [__impulse_api_room_js_onRequestGet],
    },
  {
      routePath: "/impulse-api/room",
      mountPath: "/impulse-api",
      method: "POST",
      middlewares: [],
      modules: [__impulse_api_room_js_onRequestPost],
    },
  {
      routePath: "/impulse-api/room-leave",
      mountPath: "/impulse-api",
      method: "GET",
      middlewares: [],
      modules: [__impulse_api_room_leave_js_onRequestGet],
    },
  {
      routePath: "/impulse-api/room-leave",
      mountPath: "/impulse-api",
      method: "POST",
      middlewares: [],
      modules: [__impulse_api_room_leave_js_onRequestPost],
    },
  {
      routePath: "/impulse-api/room-manage",
      mountPath: "/impulse-api",
      method: "GET",
      middlewares: [],
      modules: [__impulse_api_room_manage_js_onRequestGet],
    },
  {
      routePath: "/impulse-api/room-manage",
      mountPath: "/impulse-api",
      method: "POST",
      middlewares: [],
      modules: [__impulse_api_room_manage_js_onRequestPost],
    },
  {
      routePath: "/impulse-api/room-suggestions",
      mountPath: "/impulse-api",
      method: "GET",
      middlewares: [],
      modules: [__impulse_api_room_suggestions_js_onRequestGet],
    },
  {
      routePath: "/impulse-api/room-suggestions",
      mountPath: "/impulse-api",
      method: "POST",
      middlewares: [],
      modules: [__impulse_api_room_suggestions_js_onRequestPost],
    },
  {
      routePath: "/impulse-api/state",
      mountPath: "/impulse-api",
      method: "DELETE",
      middlewares: [],
      modules: [__impulse_api_state_js_onRequestDelete],
    },
  {
      routePath: "/impulse-api/state",
      mountPath: "/impulse-api",
      method: "GET",
      middlewares: [],
      modules: [__impulse_api_state_js_onRequestGet],
    },
  {
      routePath: "/impulse-api/state",
      mountPath: "/impulse-api",
      method: "POST",
      middlewares: [],
      modules: [__impulse_api_state_js_onRequestPost],
    },
  {
      routePath: "/impulse-api/user",
      mountPath: "/impulse-api",
      method: "GET",
      middlewares: [],
      modules: [__impulse_api_user_js_onRequestGet],
    },
  {
      routePath: "/impulse-api/user",
      mountPath: "/impulse-api",
      method: "POST",
      middlewares: [],
      modules: [__impulse_api_user_js_onRequestPost],
    },
  ]
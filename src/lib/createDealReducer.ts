/* ═══════════════════════════════════════════════════════════════
   createDealReducer — State management for the Create Deal flow
   ═══════════════════════════════════════════════════════════════ */

export interface Profile {
  id: string
  username: string
  display_name: string
  level?: number
  avatar_url?: string
}

export interface DealTemplate {
  id: string
  title: string
  stake: string
  category: string
  icon: string
  description: string
  ruleset_type: string
}

export interface TeamConfig {
  name: string
  color: string
  members: Profile[]
}

export type DealMode = '1v1' | 'team' | 'open_challenge'
export type Visibility = 'private' | 'friends' | 'public'
export type JoinMode = 'open' | 'approval' | 'invite_only'

export interface CreateDealState {
  mode: DealMode
  title: string
  stake: string
  category: string
  visibility: Visibility
  deadline: string
  joinMode: JoinMode
  maxParticipants: number
  rulesetType: string
  scoringMode: string
  description: string
  mediaFile: File | null
  mediaPreview: string | null
  mediaError: string | null
  uploadProgress: string | null
  opponent: Profile | null
  teamA: TeamConfig
  teamB: TeamConfig
  showOpponentModal: boolean
  templateId: string | null
  parentDealId: string | null
  loading: boolean
}

export type CreateDealAction =
  | { type: 'SET_MODE'; mode: DealMode }
  | { type: 'SET_FIELD'; field: keyof CreateDealState; value: any }
  | { type: 'SET_OPPONENT'; opponent: Profile | null }
  | { type: 'SET_SHOW_OPPONENT_MODAL'; show: boolean }
  | { type: 'SET_MEDIA'; file: File | null; preview: string | null }
  | { type: 'SET_MEDIA_ERROR'; error: string | null }
  | { type: 'SET_UPLOAD_PROGRESS'; progress: string | null }
  | { type: 'ADD_TEAM_MEMBER'; side: 'a' | 'b'; member: Profile }
  | { type: 'REMOVE_TEAM_MEMBER'; side: 'a' | 'b'; userId: string }
  | { type: 'SET_TEAM_NAME'; side: 'a' | 'b'; name: string }
  | { type: 'SET_TEAM_COLOR'; side: 'a' | 'b'; color: string }
  | { type: 'APPLY_TEMPLATE'; template: DealTemplate }
  | { type: 'APPLY_REMATCH'; deal: any }
  | { type: 'APPLY_CLONE'; deal: any }
  | { type: 'SET_LOADING'; loading: boolean }
  | { type: 'RESET' }

export const initialState: CreateDealState = {
  mode: '1v1',
  title: '',
  stake: '',
  category: 'custom',
  visibility: 'public',
  deadline: '',
  joinMode: 'open',
  maxParticipants: 2,
  rulesetType: 'free_text',
  scoringMode: 'manual',
  description: '',
  mediaFile: null,
  mediaPreview: null,
  mediaError: null,
  uploadProgress: null,
  opponent: null,
  teamA: { name: 'Team A', color: '#FFB800', members: [] },
  teamB: { name: 'Team B', color: '#3B82F6', members: [] },
  showOpponentModal: false,
  templateId: null,
  parentDealId: null,
  loading: false,
}

export function createDealReducer(state: CreateDealState, action: CreateDealAction): CreateDealState {
  switch (action.type) {
    case 'SET_MODE':
      return { ...state, mode: action.mode }

    case 'SET_FIELD':
      return { ...state, [action.field]: action.value }

    case 'SET_OPPONENT':
      return { ...state, opponent: action.opponent }

    case 'SET_SHOW_OPPONENT_MODAL':
      return { ...state, showOpponentModal: action.show }

    case 'SET_MEDIA':
      return { ...state, mediaFile: action.file, mediaPreview: action.preview, mediaError: null }

    case 'SET_MEDIA_ERROR':
      return { ...state, mediaError: action.error }

    case 'SET_UPLOAD_PROGRESS':
      return { ...state, uploadProgress: action.progress }

    case 'ADD_TEAM_MEMBER': {
      const key = action.side === 'a' ? 'teamA' : 'teamB'
      const team = state[key]
      if (team.members.length >= 5) return state
      if (team.members.some(m => m.id === action.member.id)) return state
      return { ...state, [key]: { ...team, members: [...team.members, action.member] } }
    }

    case 'REMOVE_TEAM_MEMBER': {
      const key = action.side === 'a' ? 'teamA' : 'teamB'
      const team = state[key]
      return { ...state, [key]: { ...team, members: team.members.filter(m => m.id !== action.userId) } }
    }

    case 'SET_TEAM_NAME': {
      const key = action.side === 'a' ? 'teamA' : 'teamB'
      return { ...state, [key]: { ...state[key], name: action.name } }
    }

    case 'SET_TEAM_COLOR': {
      const key = action.side === 'a' ? 'teamA' : 'teamB'
      return { ...state, [key]: { ...state[key], color: action.color } }
    }

    case 'APPLY_TEMPLATE':
      return {
        ...state,
        title: action.template.title,
        stake: action.template.stake,
        category: action.template.category,
        rulesetType: action.template.ruleset_type,
        templateId: action.template.id,
      }

    case 'APPLY_REMATCH':
      return {
        ...state,
        title: action.deal.title || '',
        stake: action.deal.stake || '',
        category: action.deal.category || 'custom',
        opponent: action.deal.opponent || action.deal.creator || null,
        parentDealId: action.deal.id,
      }

    case 'APPLY_CLONE':
      return {
        ...state,
        title: action.deal.title || '',
        stake: action.deal.stake || '',
        category: action.deal.category || 'custom',
        parentDealId: action.deal.id,
      }

    case 'SET_LOADING':
      return { ...state, loading: action.loading }

    case 'RESET':
      return { ...initialState }

    default:
      return state
  }
}

/* ─── Category config ─── */
export const CATEGORIES = [
  { value: 'fitness', icon: '\u{1F4AA}', label: 'Fitness' },
  { value: 'sport', icon: '\u26BD', label: 'Sport' },
  { value: 'prediction', icon: '\u{1F52E}', label: 'Vorhersage' },
  { value: 'lifestyle', icon: '\u{1F3AF}', label: 'Lifestyle' },
  { value: 'wissen', icon: '\u{1F9E0}', label: 'Wissen' },
  { value: 'fun', icon: '\u{1F3B2}', label: 'Fun' },
  { value: 'custom', icon: '\u2699\uFE0F', label: 'Custom' },
] as const

export const STAKE_PRESETS = [
  'Kasten Bier \u{1F37A}',
  'Abendessen zahlen \u{1F37D}\uFE0F',
  'Peinliches Foto posten \u{1F4F8}',
  '20 Liegest\u00FCtze \u{1F4AA}',
  'Autow\u00E4sche \u{1F697}',
  'Runde ausgeben \u{1F942}',
]

export const DEADLINE_PRESETS = [
  { label: '24h', hours: 24 },
  { label: '3 Tage', hours: 72 },
  { label: '1 Woche', hours: 168 },
  { label: '1 Monat', hours: 720 },
] as const

export const TEAM_COLORS = [
  '#FFB800', '#3B82F6', '#EF4444', '#22C55E', '#A855F7', '#F97316',
] as const

const PI = Math.PI;

const F = (find, x, y, z, rotY = 0, extra = {}) => ({
  find,
  pos: [x, y, z],
  rotY,
  ...extra,
});

const P = (module, x, y, z, rotY = 0) => ({
  module,
  pos: [x, y, z],
  rotY,
});

export const WORLD_LAYOUT_V2 = {
  room: {
    width: 60,
    height: 18,
    depth: 46,
    wallThick: 0.35,
  },

  furnitureLayout: {
    clearance: 0.78,
    wallMargin: 0.7,
    candidateStep: 1.5,
    candidateRings: 18,
    verticalOverlapThreshold: 0.2,
    maxAcceptedOverlapArea: 0.004,
    maxAcceptedBoundaryPenalty: 0.04,
  },

  furnitureAnchors: {
    // Sleep
    sleep_bed: { pos: [-21.2, 0, -17.6], rotY: 0, locked: true },
    sleep_wardrobe: { pos: [-27.1, 0, -18.5], rotY: PI / 2, locked: true },
    sleep_drawers: { pos: [-22.1, 0, -12.3], rotY: PI * 0.04, locked: true },
    sleep_chair: { pos: [-10.9, 0, -14.8], rotY: PI * 0.22, locked: true },

    // Study
    study_desk: { pos: [16.3, 0, -16.0], rotY: 0, locked: true },
    study_chair_left: { pos: [13.6, 0, -13.1], rotY: PI * 0.8, locked: true },
    study_chair_right: { pos: [18.4, 0, -13.0], rotY: PI * 0.7, locked: true },
    study_bookcase_back: { pos: [27.0, 0, -17.2], rotY: -PI / 2, locked: true },
    study_bookcase_front: { pos: [27.0, 0, -10.1], rotY: -PI / 2, locked: true },

    // Lounge
    lounge_table: { pos: [0.1, 0, 4.4], rotY: 0, locked: true },
    lounge_left: { pos: [-22.4, 0, 9.3], rotY: PI * 0.14, locked: true },
    lounge_right: { pos: [22.3, 0, 9.4], rotY: -PI * 0.17, locked: true },
    lounge_lamp: { pos: [-2.4, 0, 1.4], rotY: 0, locked: true },
    lounge_books: { pos: [2.7, 0, 2.1], rotY: 0, locked: true },

    // Kitchen / Utility
    kitchen_fridge: { pos: [24.3, 0, 14.8], rotY: PI, locked: true },
    kitchen_stove: { pos: [20.6, 0, 15.5], rotY: PI, locked: true },
    kitchen_cupboard_a: { pos: [27.0, 0, 9.2], rotY: -PI / 2, locked: true },
    kitchen_cupboard_b: { pos: [27.0, 0, 17.2], rotY: -PI / 2, locked: true },
    kitchen_drawers: { pos: [19.0, 0, 10.8], rotY: 0, locked: true },

    // Electronics / Junk
    junk_drawers: { pos: [-24.3, 0, 14.2], rotY: PI * 0.03, locked: true },
    junk_bookcase: { pos: [-27.1, 0, 11.6], rotY: PI / 2, locked: true },
    junk_vent: { pos: [-18.4, 0, 19.6], rotY: 0, locked: true },
    junk_gadgets: { pos: [-23.1, 0, 12.5], rotY: 0, locked: true },
    junk_chair: { pos: [-10.7, 0, 15.4], rotY: -PI * 0.12, locked: true },
  },

  scaleReferences: [
    { name: 'Table_01', targetHeight: 5 },
    { name: 'Table', targetHeight: 5 },
    { name: 'Chair', targetHeight: 4 },
    { name: 'Armchair_03', targetHeight: 4.5 },
    { name: 'bed_04', targetHeight: 3.5 },
    { name: 'Bookcase', targetHeight: 8 },
  ],

  shellAccents: [
    { type: 'box', size: [58, 0.24, 0.12], pos: [0, 2.8, -22.86], color: 0x7a624a },
    { type: 'box', size: [58, 0.24, 0.12], pos: [0, 2.8, 22.86], color: 0x7a624a },
    { type: 'box', size: [0.12, 0.24, 44], pos: [-29.86, 2.8, 0], color: 0x7a624a },
    { type: 'box', size: [0.12, 0.24, 44], pos: [29.86, 2.8, 0], color: 0x7a624a },
    { type: 'box', size: [6.2, 0.06, 4.8], pos: [-18, 0.03, -16], color: 0x4a2d38 },
    { type: 'box', size: [5.8, 0.06, 4.2], pos: [20, 0.03, -14], color: 0x32404f },
    { type: 'box', size: [7.5, 0.06, 5.8], pos: [0, 0.03, 4], color: 0x3c3b33 },
    { type: 'box', size: [8.0, 0.06, 5.6], pos: [20, 0.03, 14], color: 0x3e4230 },
    { type: 'box', size: [8.5, 0.06, 5.6], pos: [-20, 0.03, 14], color: 0x2f3c3d },
  ],

  decor: {
    seed: 91023,
    furniturePadding: 0.2,
    parkourPadding: 0.16,
    rugs: [
      { id: 'sleep_rug', pos: [-18.4, -16.1], size: [8.2, 5.8], rotY: 0.08, color: 0x4f4038 },
      { id: 'study_rug', pos: [18.9, -14.2], size: [8.4, 5.4], rotY: -0.06, color: 0x3a4754 },
      { id: 'lounge_rug', pos: [0.0, 6.0], size: [12.2, 9.4], rotY: 0.03, color: 0x4c3e37 },
      { id: 'kitchen_runner', pos: [22.4, 14.4], size: [9.2, 5.4], rotY: -0.02, color: 0x4a503b },
      { id: 'junk_patch', pos: [-19.8, 15.2], size: [10.4, 6.2], rotY: 0.1, color: 0x344348 },
    ],
    wallPanels: [
      { id: 'sleep_back_panel', pos: [-20.0, 3.4, -22.72], size: [8.8, 2.2, 0.06], color: 0x6f5a46 },
      { id: 'study_back_panel', pos: [18.5, 3.2, -22.72], size: [9.8, 2.1, 0.06], color: 0x5f5e4e },
      { id: 'front_center_panel', pos: [0.0, 3.0, 22.72], size: [11.0, 2.0, 0.06], color: 0x6a5e4b },
      { id: 'left_spine_panel', pos: [-29.72, 2.8, 0.0], size: [0.06, 1.8, 10.0], color: 0x6b4f3f },
      { id: 'right_spine_panel', pos: [29.72, 2.8, 0.0], size: [0.06, 1.8, 10.0], color: 0x6b4f3f },
    ],
    clutterPresets: {
      paper_sheet: {
        shape: 'box',
        size: [0.44, 0.02, 0.31],
        colors: [0xd9d0b8, 0xcfc6ad, 0xe2d9c4],
        roughness: 0.97,
        metalness: 0.0,
        surface: 'paper',
        castShadow: false,
        reserveSpace: false,
      },
      paperback: {
        shape: 'box',
        size: [0.34, 0.09, 0.24],
        colors: [0x6e6b7f, 0x5f7a62, 0x8a6949, 0x696f8b],
        roughness: 0.86,
        metalness: 0.02,
        surface: 'wood',
      },
      mug: {
        shape: 'cylinder',
        size: [0.16, 0.17, 0.16],
        colors: [0xd5c8ab, 0x9aa7b4, 0x8f9a8a],
        roughness: 0.44,
        metalness: 0.08,
        surface: 'ceramic',
      },
      can: {
        shape: 'cylinder',
        size: [0.1, 0.2, 0.1],
        colors: [0xaeb5bf, 0x8d98a5, 0xb6b089],
        roughness: 0.38,
        metalness: 0.24,
        surface: 'metal',
      },
      toy_block: {
        shape: 'box',
        size: [0.35, 0.32, 0.35],
        colors: [0xbf8d56, 0x9570b3, 0x6790b5, 0xb97170],
        roughness: 0.72,
        metalness: 0.03,
        surface: 'wood',
      },
      cable_knot: {
        shape: 'torus',
        size: [0.22, 0.045, 0.22],
        colors: [0x2d323a, 0x3a404c],
        roughness: 0.78,
        metalness: 0.08,
        surface: 'rubber',
        castShadow: false,
        reserveSpace: false,
      },
    },
    clutterZones: [
      {
        id: 'sleep_clutter',
        bounds: [-28.0, -9.6, -21.0, -8.4],
        count: 11,
        margin: 0.55,
        modules: [
          { id: 'paper_sheet', weight: 5 },
          { id: 'paperback', weight: 4 },
          { id: 'mug', weight: 2 },
          { id: 'toy_block', weight: 2 },
          { id: 'cable_knot', weight: 2 },
        ],
      },
      {
        id: 'study_clutter',
        bounds: [10.0, 28.2, -20.8, -8.4],
        count: 12,
        margin: 0.5,
        modules: [
          { id: 'paper_sheet', weight: 4 },
          { id: 'paperback', weight: 5 },
          { id: 'mug', weight: 2 },
          { id: 'can', weight: 2 },
          { id: 'cable_knot', weight: 1 },
        ],
      },
      {
        id: 'lounge_clutter',
        bounds: [-9.6, 9.6, 1.0, 12.6],
        count: 12,
        margin: 0.65,
        modules: [
          { id: 'paper_sheet', weight: 4 },
          { id: 'paperback', weight: 3 },
          { id: 'mug', weight: 2 },
          { id: 'toy_block', weight: 5 },
          { id: 'can', weight: 2 },
          { id: 'cable_knot', weight: 2 },
        ],
      },
      {
        id: 'kitchen_clutter',
        bounds: [14.2, 28.4, 8.4, 21.0],
        count: 10,
        margin: 0.5,
        modules: [
          { id: 'paper_sheet', weight: 2 },
          { id: 'paperback', weight: 2 },
          { id: 'mug', weight: 4 },
          { id: 'can', weight: 5 },
          { id: 'toy_block', weight: 1 },
          { id: 'cable_knot', weight: 1 },
        ],
      },
      {
        id: 'junk_clutter',
        bounds: [-28.2, -8.4, 8.6, 21.2],
        count: 12,
        margin: 0.5,
        modules: [
          { id: 'paper_sheet', weight: 3 },
          { id: 'paperback', weight: 3 },
          { id: 'mug', weight: 1 },
          { id: 'can', weight: 4 },
          { id: 'toy_block', weight: 3 },
          { id: 'cable_knot', weight: 4 },
        ],
      },
      {
        id: 'entry_clutter',
        bounds: [-5.8, 5.8, -9.8, -3.0],
        count: 6,
        margin: 0.55,
        modules: [
          { id: 'paper_sheet', weight: 4 },
          { id: 'paperback', weight: 2 },
          { id: 'can', weight: 2 },
          { id: 'toy_block', weight: 1 },
          { id: 'cable_knot', weight: 2 },
        ],
      },
    ],
  },

  furniture: [
    // Sleep Zone
    F('bed_04', -20.5, 0, -17.4, 0, { anchor: 'sleep_bed' }),
    F('Wardrobe', -27.2, 0, -18.6, PI / 2, { anchor: 'sleep_wardrobe' }),
    F('Chest_drawers_05', -22.2, 0, -12.2, PI * 0.05, { anchor: 'sleep_drawers' }),
    F('Armchair_03', -11.0, 0, -14.7, PI * 0.25, { anchor: 'sleep_chair' }),
    F('Lamp_01', -17.8, 0, -14.3, 0),
    F('Flower_Table_01', -13.0, 0, -12.5, 0),
    F('Painting_04', -20, 7.8, -22.6, 0, { collider: false }),

    // Study Zone
    F('Table_01', 16.2, 0, -16.0, 0, { anchor: 'study_desk' }),
    F('Chair', 13.7, 0, -13.2, PI * 0.8, { anchor: 'study_chair_left' }),
    F('Chair_01', 18.3, 0, -13.1, PI * 0.7, { anchor: 'study_chair_right' }),
    F('Bookcase_01', 27.1, 0, -17.2, -PI / 2, { anchor: 'study_bookcase_back' }),
    F('Bookcase_02', 27.1, 0, -10.3, -PI / 2, { anchor: 'study_bookcase_front' }),
    F('Desk_lamp', 16.1, 0, -15.8, 0),
    F('Phone', 17.0, 0, -15.9, 0),
    F('Radio_01', 20.8, 0, -13.8, 0),
    F('Painting_03', 18, 7.8, -22.6, 0, { collider: false }),

    // Lounge Zone
    F('Flower_Table_01', 0.3, 0, 3.3, 0, { anchor: 'lounge_table' }),
    F('Armchair_04', -12.0, 0, 7.8, PI * 0.14, { anchor: 'lounge_left' }),
    F('Armchair_05', 11.9, 0, 7.9, -PI * 0.17, { anchor: 'lounge_right' }),
    F('Lamp', -1.2, 0, 1.4, 0, { anchor: 'lounge_lamp' }),
    F('Books_001', 1.8, 0, 2.1, 0, { anchor: 'lounge_books' }),
    F('Ceiling_Fan', 0, 17.2, 0, 0, { collider: false }),

    // Kitchen / Utility Zone
    F('Refrigerator001', 24.3, 0, 14.8, PI, { anchor: 'kitchen_fridge' }),
    F('Stove', 20.6, 0, 15.5, PI, { anchor: 'kitchen_stove' }),
    F('Cupboard_01002', 27.0, 0, 9.2, -PI / 2, { anchor: 'kitchen_cupboard_a' }),
    F('Cupboard_01003', 27.0, 0, 17.2, -PI / 2, { anchor: 'kitchen_cupboard_b' }),
    F('Chest_drawers_04', 19.0, 0, 10.8, 0, { anchor: 'kitchen_drawers' }),
    F('Trash_can', 15.0, 0, 18.2, 0),

    // Electronics / Junk Zone
    F('Chest_drawers_02', -24.3, 0, 14.2, PI * 0.03, { anchor: 'junk_drawers' }),
    F('Bookcase', -27.1, 0, 11.6, PI / 2, { anchor: 'junk_bookcase' }),
    F('Ventilator_01', -18.4, 0, 19.6, 0, { anchor: 'junk_vent' }),
    F('Gadgets', -23.1, 0, 12.5, 0, { anchor: 'junk_gadgets' }),
    F('Armchair_08', -10.8, 0, 15.4, -PI * 0.12, { anchor: 'junk_chair' }),
    F('Painting_01', -18, 7.5, 22.6, PI, { collider: false }),
    F('Ceiling_Fan_01', -15, 17.2, 14, 0, { collider: false }),
    F('Ceiling_Fan_02', 17, 17.2, 12, 0, { collider: false }),
  ],

  outlets: [
    { id: 'spawn_hub_1', pos: [0.0, 1.05, -10.5], normal: [0, 0, 1] },
    { id: 'lounge_hub_1', pos: [0.0, 1.05, 10.8], normal: [0, 0, -1] },
    { id: 'back_sleep_1', pos: [-22.5, 1.05, -22.74], normal: [0, 0, 1] },
    { id: 'back_study_1', pos: [18.5, 1.05, -22.74], normal: [0, 0, 1] },
    { id: 'front_center_1', pos: [-2.0, 1.05, 22.74], normal: [0, 0, -1] },
    { id: 'front_kitchen_1', pos: [22.5, 1.05, 22.74], normal: [0, 0, -1] },
    { id: 'left_sleep_1', pos: [-29.74, 1.05, -14.0], normal: [1, 0, 0] },
    { id: 'left_junk_1', pos: [-29.74, 1.05, 15.5], normal: [1, 0, 0] },
    { id: 'left_center_1', pos: [-29.74, 1.05, 1.5], normal: [1, 0, 0] },
    { id: 'right_study_1', pos: [29.74, 1.05, -12.5], normal: [-1, 0, 0] },
    { id: 'right_kitchen_1', pos: [29.74, 1.05, 13.0], normal: [-1, 0, 0] },
    { id: 'right_center_1', pos: [29.74, 1.05, 1.2], normal: [-1, 0, 0] },
  ],

  stains: [
    // Sleep Zone
    { id: 'sleep_stain_1', zone: 'sleep', pos: [-18.6, 0.035, -15.4], radius: 0.62, points: 12 },
    { id: 'sleep_stain_2', zone: 'sleep', pos: [-14.3, 0.035, -12.9], radius: 0.54, points: 10 },

    // Study Zone
    { id: 'study_stain_1', zone: 'study', pos: [15.9, 0.035, -14.1], radius: 0.58, points: 11 },
    { id: 'study_stain_2', zone: 'study', pos: [20.8, 0.035, -11.8], radius: 0.5, points: 9 },

    // Lounge Zone
    { id: 'lounge_stain_1', zone: 'lounge', pos: [-1.4, 0.035, 2.8], radius: 0.66, points: 13 },
    { id: 'lounge_stain_2', zone: 'lounge', pos: [3.2, 0.035, 5.6], radius: 0.57, points: 10 },
    { id: 'lounge_stain_3', zone: 'lounge', pos: [-4.8, 0.035, 5.2], radius: 0.49, points: 9 },

    // Kitchen / Utility Zone
    { id: 'kitchen_stain_1', zone: 'kitchen', pos: [20.1, 0.035, 13.6], radius: 0.61, points: 12 },
    { id: 'kitchen_stain_2', zone: 'kitchen', pos: [24.8, 0.035, 16.2], radius: 0.55, points: 10 },

    // Electronics / Junk Zone
    { id: 'junk_stain_1', zone: 'junk', pos: [-23.8, 0.035, 13.9], radius: 0.63, points: 12 },
    { id: 'junk_stain_2', zone: 'junk', pos: [-18.4, 0.035, 18.3], radius: 0.52, points: 10 },
    { id: 'junk_stain_3', zone: 'junk', pos: [-11.3, 0.035, 15.8], radius: 0.48, points: 9 },
  ],

  waters: [
    { id: 'kitchen_water_1', zone: 'kitchen', pos: [21.8, 0.036, 14.8], radius: 0.54, points: 8 },
    { id: 'kitchen_water_2', zone: 'kitchen', pos: [24.2, 0.036, 12.9], radius: 0.46, points: 8 },
    { id: 'lounge_water_1', zone: 'lounge', pos: [2.8, 0.036, 3.2], radius: 0.52, points: 7 },
    { id: 'study_water_1', zone: 'study', pos: [15.2, 0.036, -12.4], radius: 0.43, points: 7 },
    { id: 'sleep_water_1', zone: 'sleep', pos: [-16.6, 0.036, -13.6], radius: 0.45, points: 7 },
  ],

  climbables: [
    {
      id: 'entry_cord',
      type: 'cord',
      pos: [6.4, 0.42, -7.4],
      height: 4.5,
      radius: 0.13,
      rotY: -PI * 0.12,
      normal: [-0.2, 0, 1],
    },
    {
      id: 'study_ladder',
      type: 'ladder',
      pos: [14.8, 0.2, -11.8],
      height: 4.9,
      width: 0.62,
      depth: 0.26,
      rotY: PI * 0.02,
      normal: [0, 0, 1],
    },
    {
      id: 'junk_cord',
      type: 'cord',
      pos: [-18.8, 0.38, 15.6],
      height: 5.3,
      radius: 0.14,
      rotY: PI * 0.35,
      normal: [0.32, 0, 0.95],
    },
  ],

  storyTriggers: [
    {
      id: 'junk_signal_node',
      pos: [-23.4, 0.75, 12.8],
      radius: 2.2,
      once: true,
      prompt: 'Press E to inspect buzzing screen',
      cutsceneId: 'signalLeak',
    },
  ],

  npcs: [
    {
      id: 'socket_scout',
      name: 'Socket Scout',
      pos: [5.8, 0, -7.8],
      interactRadius: 2.15,
      walkSpeed: 0.52,
      patrol: [
        [5.8, 0, -7.8],
        [7.4, 0, -6.2],
        [6.1, 0, -5.0],
        [4.9, 0, -6.4],
      ],
      dialogue: {
        start: 'intro',
        nodes: {
          intro: {
            speaker: 'Socket Scout',
            text: 'Hey helper bot. Need directions or spare bits?',
            choices: [
              { label: 'Where are outlets?', next: 'outlet_tip' },
              { label: 'Any spare bits?', next: 'gift_bits' },
              { label: 'Later, scout.', endReason: 'exit' },
            ],
          },
          outlet_tip: {
            speaker: 'Socket Scout',
            text: 'Watch for cyan glow on the walls. Recharge points are in every zone.',
            next: 'intro',
          },
          gift_bits: {
            speaker: 'Socket Scout',
            text: 'Take these 20 bits. Keep the house stable tonight.',
            grantCurrency: 20,
            end: true,
            endReason: 'gift',
          },
        },
      },
    },
    {
      id: 'junk_mender',
      name: 'Junk Mender',
      pos: [-15.7, 0, 16.8],
      interactRadius: 2.2,
      walkSpeed: 0.4,
      patrol: [
        [-15.7, 0, 16.8],
        [-13.5, 0, 15.6],
      ],
      dialogue: {
        start: 'intro',
        nodes: {
          intro: {
            speaker: 'Junk Mender',
            text: 'Those heavy blocks can become stepping stools.',
            choices: [
              { label: 'How do I move them?', next: 'push_tip' },
              { label: 'Good to know.', endReason: 'exit' },
            ],
          },
          push_tip: {
            speaker: 'Junk Mender',
            text: 'Lean into a block while moving. They slide slow, but they climb fast.',
            end: true,
            endReason: 'tip',
          },
        },
      },
    },
  ],

  shopTerminals: [
    {
      id: 'base_station_pc',
      pos: [2.35, 0.62, -9.6],
      rotY: PI * 0.05,
      interactRadius: 2.35,
      prompt: 'Press E to open Chibi-PC Shop',
    },
  ],

  pushables: [
    {
      id: 'matchbox_a',
      pos: [-3.2, 0.34, -2.8],
      size: [1.12, 0.68, 1.12],
      color: 0xb99262,
      mass: 14,
      friction: 1.6,
      linearDamping: 6.8,
      angularDamping: 8.5,
    },
    {
      id: 'sponge_crate',
      pos: [8.6, 0.4, -4.8],
      size: [1.35, 0.8, 1.35],
      color: 0xd5b883,
      mass: 18,
      friction: 1.7,
      linearDamping: 7.2,
      angularDamping: 8.8,
    },
    {
      id: 'battery_box',
      pos: [-11.8, 0.32, 9.6],
      size: [0.95, 0.64, 1.22],
      color: 0x8b6c49,
      mass: 12,
      friction: 1.55,
      linearDamping: 6.6,
      angularDamping: 8.1,
    },
    {
      id: 'toy_cube',
      pos: [14.5, 0.36, 10.6],
      size: [1.05, 0.72, 1.05],
      color: 0xc79c57,
      mass: 15,
      friction: 1.62,
      linearDamping: 6.9,
      angularDamping: 8.4,
    },
  ],

  grabbables: [
    {
      id: 'proto_leg',
      kind: 'robot_part',
      pos: [-18.2, 0.28, 13.2],
      size: [0.34, 0.34, 0.34],
      color: 0xaeb8c4,
      mass: 2.4,
      value: 22,
    },
    {
      id: 'crumpled_paper_1',
      kind: 'trash',
      pos: [1.8, 0.22, 4.6],
      size: [0.28, 0.26, 0.28],
      color: 0xd8d1b5,
      mass: 1.2,
      value: 6,
    },
    {
      id: 'battery_scrap',
      kind: 'scrap',
      pos: [20.3, 0.24, -11.6],
      size: [0.3, 0.22, 0.38],
      color: 0x8d9ab0,
      mass: 1.8,
      value: 12,
    },
  ],

  roomTransitions: [
    {
      id: 'stairs_to_upper',
      min: [27.1, 0.0, -1.6],
      max: [29.7, 2.6, 1.6],
      targetRoom: 'upperFloor',
      targetSpawn: [-23.2, 1.55, 0.0],
      prompt: 'Transition: Upstairs',
    },
  ],

  parkour: {
    modules: {
      plank: { size: [1.6, 0.16, 1.2], color: 0xc7b38e, roughness: 0.68 },
      crate: { size: [1.0, 0.6, 1.0], color: 0x8a6a44, roughness: 0.78 },
      ledge: { size: [2.2, 0.12, 0.8], color: 0x6a7c89, roughness: 0.62 },
    },

    routes: [
      {
        id: 'sleep-spine',
        name: 'Sleep Zone Spine',
        color: 0xe4c56f,
        nodes: [
          P('crate', -4.0, 1.0, 1.0),
          P('plank', -6.0, 1.4, -1.0, 0.2),
          P('plank', -8.0, 1.8, -3.0, 0.2),
          P('ledge', -10.0, 2.3, -5.0, 0.2),
          P('crate', -12.0, 2.9, -7.0, 0.2),
          P('plank', -14.0, 3.5, -9.0, 0.2),
          P('plank', -16.0, 4.1, -11.0, 0.3),
          P('ledge', -18.0, 4.7, -13.0, 0.4),
          P('crate', -20.0, 5.2, -15.0, 0.3),
          P('plank', -19.0, 4.8, -12.0, 1.7),
          P('ledge', -17.0, 4.4, -9.0, 1.5),
          P('crate', -15.0, 3.9, -6.0, 1.4),
          P('plank', -13.0, 3.2, -4.0, 1.2),
          P('plank', -11.0, 2.5, -2.0, 1.1),
          P('crate', -9.0, 1.8, 0.0, 1.0),
          P('ledge', -7.0, 1.3, 2.0, 0.9),
        ],
      },
      {
        id: 'study-arc',
        name: 'Study Arc Route',
        color: 0x7ec8f2,
        nodes: [
          P('crate', 2.0, 1.0, 0.0),
          P('plank', 4.0, 1.4, -2.0, -0.1),
          P('plank', 7.0, 1.8, -4.0, -0.2),
          P('ledge', 10.0, 2.3, -6.0, -0.2),
          P('crate', 13.0, 2.9, -8.0, -0.3),
          P('plank', 16.0, 3.5, -10.0, -0.3),
          P('plank', 19.0, 4.1, -12.0, -0.2),
          P('ledge', 22.0, 4.8, -14.0, -0.2),
          P('crate', 20.0, 5.1, -10.0, 2.2),
          P('plank', 18.0, 4.6, -7.0, 2.1),
          P('ledge', 15.0, 4.0, -4.0, 2.0),
          P('crate', 12.0, 3.3, -1.0, 1.9),
          P('plank', 10.0, 2.6, 2.0, 1.7),
          P('plank', 12.0, 2.1, 5.0, 1.5),
          P('crate', 14.0, 1.6, 8.0, 1.4),
          P('ledge', 16.0, 1.2, 11.0, 1.3),
        ],
      },
      {
        id: 'utility-loop',
        name: 'Utility Loop',
        color: 0x9be28e,
        nodes: [
          P('crate', -11.0, 1.0, 7.0),
          P('plank', -13.0, 1.4, 9.0, 0.2),
          P('plank', -15.0, 1.9, 11.0, 0.3),
          P('ledge', -17.0, 2.5, 13.0, 0.3),
          P('crate', -19.0, 3.1, 15.0, 0.4),
          P('plank', -21.0, 3.7, 17.0, 0.4),
          P('ledge', -18.0, 4.3, 19.0, -2.8),
          P('crate', -15.0, 4.9, 20.0, -2.6),
          P('plank', -12.0, 5.2, 18.0, -2.4),
          P('ledge', -9.0, 4.7, 16.0, -2.2),
          P('crate', -6.0, 4.1, 14.0, -2.0),
          P('plank', -3.0, 3.5, 12.0, -1.8),
          P('plank', 0.0, 2.9, 10.0, -1.7),
          P('ledge', 3.0, 2.3, 12.0, -1.5),
          P('crate', 6.0, 1.7, 14.0, -1.3),
          P('plank', 9.0, 1.2, 16.0, -1.1),
        ],
      },
    ],
  },
};

function cloneLayout(source) {
  return JSON.parse(JSON.stringify(source));
}

export const WORLD_LAYOUT_UPPER = (() => {
  const next = cloneLayout(WORLD_LAYOUT_V2);

  next.room = {
    width: 52,
    height: 16,
    depth: 40,
    wallThick: 0.35,
  };

  next.furnitureAnchors = {
    ...next.furnitureAnchors,
    upper_sleep_bed: { pos: [-14.6, 0, -13.8], rotY: 0, locked: true },
    upper_sleep_wardrobe: { pos: [-23.5, 0, -14.1], rotY: PI / 2, locked: true },
    upper_study_desk: { pos: [11.8, 0, -11.4], rotY: 0, locked: true },
    upper_study_chair: { pos: [13.4, 0, -8.8], rotY: PI * 0.72, locked: true },
    upper_study_bookcase: { pos: [22.7, 0, -9.1], rotY: -PI / 2, locked: true },
    upper_lounge_table: { pos: [-0.2, 0, 7.1], rotY: 0, locked: true },
    upper_lounge_sofa: { pos: [-16.8, 0, 12.0], rotY: PI * 0.23, locked: true },
    upper_kitchen_cupboard: { pos: [22.8, 0, 12.4], rotY: -PI / 2, locked: true },
    upper_kitchen_stove: { pos: [16.8, 0, 13.1], rotY: PI, locked: true },
    upper_junk_drawers: { pos: [-20.2, 0, 11.6], rotY: PI * 0.08, locked: true },
    upper_junk_chair: { pos: [-8.7, 0, 13.4], rotY: -PI * 0.18, locked: true },
  };

  next.furniture = [
    F('bed_04', -14.6, 0, -13.8, 0, { anchor: 'upper_sleep_bed' }),
    F('Wardrobe', -23.6, 0, -14.1, PI / 2, { anchor: 'upper_sleep_wardrobe' }),
    F('Table_01', 11.8, 0, -11.4, 0, { anchor: 'upper_study_desk' }),
    F('Chair_01', 13.5, 0, -8.8, PI * 0.72, { anchor: 'upper_study_chair' }),
    F('Bookcase_02', 22.7, 0, -9.1, -PI / 2, { anchor: 'upper_study_bookcase' }),
    F('Flower_Table_01', -1.2, 0, 6.3, 0, { anchor: 'upper_lounge_table' }),
    F('Armchair_04', -8.7, 0, 10.4, PI * 0.22, { anchor: 'upper_lounge_sofa' }),
    F('Cupboard_01003', 22.8, 0, 12.4, -PI / 2, { anchor: 'upper_kitchen_cupboard' }),
    F('Stove', 16.8, 0, 13.1, PI, { anchor: 'upper_kitchen_stove' }),
    F('Chest_drawers_02', -20.2, 0, 11.6, PI * 0.08, { anchor: 'upper_junk_drawers' }),
    F('Armchair_07', -9.4, 0, 13.3, -PI * 0.18, { anchor: 'upper_junk_chair' }),
    F('Ceiling_Fan', 0, 15.4, 0, 0, { collider: false }),
    F('Ceiling_Fan_02', 14, 15.4, 10, 0, { collider: false }),
  ];

  next.decor = {
    ...next.decor,
    seed: 91079,
    rugs: [
      { id: 'upper_sleep_rug', pos: [-14.6, -12.5], size: [7.6, 5.2], rotY: 0.07, color: 0x4f453d },
      { id: 'upper_center_rug', pos: [-1.1, 7.3], size: [10.8, 7.2], rotY: 0.04, color: 0x4f4336 },
      { id: 'upper_right_runner', pos: [17.8, 11.8], size: [8.0, 4.8], rotY: -0.03, color: 0x4a4f40 },
    ],
    wallPanels: [
      { id: 'upper_back_panel_left', pos: [-13.6, 3.0, -19.72], size: [8.0, 2.0, 0.06], color: 0x655845 },
      { id: 'upper_back_panel_right', pos: [11.8, 3.0, -19.72], size: [8.2, 2.0, 0.06], color: 0x5f5f4f },
      { id: 'upper_front_panel_mid', pos: [-2.0, 2.8, 19.72], size: [9.0, 1.9, 0.06], color: 0x6b604f },
    ],
    clutterZones: [
      {
        id: 'upper_sleep_clutter',
        bounds: [-24.8, -8.6, -17.8, -8.0],
        count: 8,
        margin: 0.5,
        modules: [
          { id: 'paper_sheet', weight: 5 },
          { id: 'paperback', weight: 4 },
          { id: 'mug', weight: 2 },
          { id: 'cable_knot', weight: 2 },
        ],
      },
      {
        id: 'upper_study_clutter',
        bounds: [7.0, 24.6, -14.8, -6.4],
        count: 9,
        margin: 0.5,
        modules: [
          { id: 'paper_sheet', weight: 3 },
          { id: 'paperback', weight: 5 },
          { id: 'mug', weight: 2 },
          { id: 'can', weight: 2 },
          { id: 'cable_knot', weight: 1 },
        ],
      },
      {
        id: 'upper_lounge_clutter',
        bounds: [-8.8, 5.4, 3.4, 14.8],
        count: 9,
        margin: 0.55,
        modules: [
          { id: 'paper_sheet', weight: 3 },
          { id: 'paperback', weight: 3 },
          { id: 'toy_block', weight: 4 },
          { id: 'can', weight: 2 },
          { id: 'cable_knot', weight: 2 },
        ],
      },
      {
        id: 'upper_right_clutter',
        bounds: [12.2, 24.8, 7.4, 16.2],
        count: 7,
        margin: 0.5,
        modules: [
          { id: 'paper_sheet', weight: 2 },
          { id: 'paperback', weight: 2 },
          { id: 'mug', weight: 4 },
          { id: 'can', weight: 4 },
          { id: 'cable_knot', weight: 1 },
        ],
      },
    ],
  };

  next.outlets = [
    { id: 'upper_spawn', pos: [-22.8, 1.05, 0.0], normal: [1, 0, 0] },
    { id: 'upper_back_left', pos: [-16.0, 1.05, -19.74], normal: [0, 0, 1] },
    { id: 'upper_back_right', pos: [14.5, 1.05, -19.74], normal: [0, 0, 1] },
    { id: 'upper_front_right', pos: [17.0, 1.05, 19.74], normal: [0, 0, -1] },
    { id: 'upper_right_mid', pos: [25.74, 1.05, 2.2], normal: [-1, 0, 0] },
    { id: 'upper_left_mid', pos: [-25.74, 1.05, -2.4], normal: [1, 0, 0] },
  ];

  next.stains = [
    { id: 'up_stain_1', zone: 'sleep', pos: [-12.8, 0.035, -11.6], radius: 0.56, points: 11 },
    { id: 'up_stain_2', zone: 'study', pos: [11.3, 0.035, -9.7], radius: 0.52, points: 10 },
    { id: 'up_stain_3', zone: 'lounge', pos: [-1.6, 0.035, 6.6], radius: 0.6, points: 12 },
    { id: 'up_stain_4', zone: 'kitchen', pos: [16.5, 0.035, 12.7], radius: 0.53, points: 10 },
    { id: 'up_stain_5', zone: 'junk', pos: [-18.8, 0.035, 11.9], radius: 0.5, points: 9 },
  ];

  next.waters = [
    { id: 'up_water_1', zone: 'lounge', pos: [0.8, 0.036, 7.6], radius: 0.47, points: 7 },
    { id: 'up_water_2', zone: 'kitchen', pos: [15.4, 0.036, 11.5], radius: 0.45, points: 7 },
  ];

  next.climbables = [
    {
      id: 'upper_cord_a',
      type: 'cord',
      pos: [-6.5, 0.36, 8.4],
      height: 4.4,
      radius: 0.13,
      rotY: PI * 0.19,
      normal: [0.2, 0, 1],
    },
    {
      id: 'upper_ladder_a',
      type: 'ladder',
      pos: [10.2, 0.2, -8.8],
      height: 4.6,
      width: 0.62,
      depth: 0.26,
      rotY: -PI * 0.03,
      normal: [0, 0, 1],
    },
  ];

  next.npcs = [
    {
      id: 'attic_greeter',
      name: 'Attic Greeter',
      pos: [-6.2, 0, 7.5],
      interactRadius: 2.1,
      walkSpeed: 0.44,
      patrol: [
        [-6.2, 0, 7.5],
        [-4.3, 0, 8.7],
      ],
      dialogue: {
        start: 'intro',
        nodes: {
          intro: {
            speaker: 'Attic Greeter',
            text: 'Welcome upstairs. Mind the drop, little helper.',
            choices: [
              { label: 'Any tips?', next: 'tip' },
              { label: 'Thanks.', endReason: 'exit' },
            ],
          },
          tip: {
            speaker: 'Attic Greeter',
            text: 'Use your rotor while falling. It saves power and your parts.',
            end: true,
            endReason: 'tip',
          },
        },
      },
    },
  ];

  next.shopTerminals = [
    {
      id: 'upper_station_pc',
      pos: [-20.8, 0.62, 0.2],
      rotY: PI * -0.06,
      interactRadius: 2.35,
      prompt: 'Press E to open Chibi-PC Shop',
    },
  ];

  next.pushables = [
    {
      id: 'up_push_1',
      pos: [-2.8, 0.34, 5.9],
      size: [1.08, 0.68, 1.08],
      color: 0xb18958,
      mass: 13,
      friction: 1.55,
      linearDamping: 6.7,
      angularDamping: 8.2,
    },
    {
      id: 'up_push_2',
      pos: [11.9, 0.36, -8.1],
      size: [1.0, 0.72, 1.2],
      color: 0xc1a16f,
      mass: 15,
      friction: 1.62,
      linearDamping: 6.9,
      angularDamping: 8.5,
    },
  ];

  next.grabbables = [
    {
      id: 'up_proto_gear',
      kind: 'robot_part',
      pos: [10.4, 0.24, -8.6],
      size: [0.3, 0.26, 0.3],
      color: 0xa6b7c9,
      mass: 2.1,
      value: 18,
    },
  ];

  next.roomTransitions = [
    {
      id: 'stairs_to_main',
      min: [-25.8, 0.0, -1.7],
      max: [-22.9, 2.6, 1.7],
      targetRoom: 'mainFloor',
      targetSpawn: [25.4, 1.55, 0.0],
      prompt: 'Transition: Main Floor',
    },
  ];

  return next;
})();

export const WORLD_LAYOUTS = Object.freeze({
  mainFloor: WORLD_LAYOUT_V2,
  upperFloor: WORLD_LAYOUT_UPPER,
});

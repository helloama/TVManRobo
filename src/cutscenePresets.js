export const CUTSCENE_PRESETS = {
  introArrival: {
    once: true,
    defaultSpeaker: 'Phetta House',
    steps: [
      {
        duration: 1.7,
        camPos: [5.6, 3.1, -5.6],
        lookAt: [0.0, 1.0, -8.0],
        dialogue: 'TV-Man online. Helper routine active.',
      },
      {
        duration: 1.6,
        camPos: [1.8, 2.4, -6.4],
        lookAt: [0.0, 0.95, -8.0],
        dialogue: 'Recharge at glowing wall outlets.',
      },
      {
        duration: 1.6,
        camPos: [-3.2, 2.8, -3.4],
        lookAt: [0.5, 0.9, -5.0],
        dialogue: 'Clean corrupted stains to restore Happy Points.',
      },
      {
        duration: 1.4,
        camPos: [2.2, 2.1, -4.2],
        lookAt: [0.0, 0.9, -7.2],
        dialogue: 'Begin helper duties.',
      },
    ],
  },

  signalLeak: {
    once: true,
    defaultSpeaker: 'The Screens',
    steps: [
      {
        duration: 1.3,
        camPos: [-21.0, 2.3, 10.7],
        lookAt: [-23.4, 0.9, 12.8],
        dialogue: '...static crawling through the walls...',
      },
      {
        duration: 1.4,
        camPos: [-25.1, 1.8, 11.3],
        lookAt: [-23.5, 0.95, 12.8],
        dialogue: 'Find and clean the residue before the Glitch Bugs hatch.',
      },
      {
        duration: 1.2,
        camPos: [-22.7, 1.9, 14.2],
        lookAt: [-23.3, 0.9, 12.8],
        dialogue: 'Signal logged. Updating helper objective...',
      },
    ],
  },
};

import { Glider, GadgetIdentifier, Thruster, ThrusterSlot } from '../types';

const getRandomInt = (min: number, max: number): number => {
  min = Math.ceil(min);
  max = Math.floor(max);
  return Math.floor(Math.random() * (max - min + 1)) + min;
};

const getRandomFloat = (min: number, max: number, decimals: number): number => {
  const str = (Math.random() * (max - min) + min).toFixed(decimals);
  return parseFloat(str);
};

const generateGliderName = (): string => {
    const prefixes = ["Aero", "Sky", "Star", "Void", "Sun", "Gale", "Nova", "Iron"];
    const suffixes = ["Dart", "Wing", "Striker", "Javelin", "Clipper", "Rider", "Blade", "Fury"];
    const prefix = prefixes[getRandomInt(0, prefixes.length - 1)];
    const suffix = suffixes[getRandomInt(0, suffixes.length - 1)];
    const modelNumber = getRandomInt(1, 9) * 100;
    return `${prefix}-${suffix} ${modelNumber}`;
}

export const generateGlider = (): Glider => {
  // Generate 1-3 unique gadgets
  const allGadgets: GadgetIdentifier[] = ["grapple", "shield", "microjet", "fuel", "boost"];
  const shuffledGadgets = allGadgets.sort(() => 0.5 - Math.random());
  const numGadgets = getRandomInt(1, 3);
  const selectedGadgets = shuffledGadgets.slice(0, numGadgets);

  const thrusters: Thruster[] = [
    {
      slot: "aft",
      impulse: getRandomFloat(1.5, 4.0, 2),
      cooldown: getRandomFloat(2.0, 5.0, 2),
    },
    {
      slot: "left",
      impulse: getRandomFloat(1.0, 3.0, 2),
      cooldown: getRandomFloat(2.5, 6.0, 2),
    },
    {
      slot: "right",
      impulse: getRandomFloat(1.0, 3.0, 2),
      cooldown: getRandomFloat(2.5, 6.0, 2),
    }
  ];

  const glider: Glider = {
    name: generateGliderName(),
    wings: {
      area: getRandomFloat(1.0, 1.5, 2),
      stiffness: getRandomFloat(0.5, 1.0, 2),
    },
    thrusters,
    gadgets: selectedGadgets,
  };

  return glider;
};
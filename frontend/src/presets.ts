import { PresetCategory } from './types';

export const defaultPresets: PresetCategory[] = [
  {
    category: 'Coffee',
    color: '#6f4e37',
    items: [
      { description: 'Espresso', price: 2.5 },
      { description: 'Americano', price: 3.0 }
    ],
    extras: [
      { name: 'Milk', price: 0.5, type: 'checkbox' },
      { name: 'Sugar', price: 0.2, type: 'number', unit: 'tsp' }
    ]
  },
  {
    category: 'Pastry',
    color: '#f4a460',
    items: [
      { description: 'Croissant', price: 1.5 },
      { description: 'Muffin', price: 2.0 }
    ],
    extras: []
  }
];

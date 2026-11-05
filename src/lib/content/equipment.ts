import { newItem, type Item } from '../rules/model';
export const equipment: { name: string; values: Partial<Item> }[] = [
  {
    name: 'Sztylet',
    values: {
      kind: 'weapon',
      damage: 'Si+k4',
      range: '3/6/12',
      weight: 1,
      price: 25,
      notes: 'SW 2015, s. 56–57',
    },
  },
  {
    name: 'Nóż wojskowy',
    values: {
      kind: 'weapon',
      damage: 'Si+k4',
      weight: 3,
      price: 50,
      notes: 'SW 2015, s. 56; Przetrwanie +1 z użyciem noża',
    },
  },
  {
    name: 'Pałka policyjna',
    values: { kind: 'weapon', damage: 'Si+k4', weight: 1, price: 10, notes: 'SW 2015, s. 56' },
  },
  {
    name: 'Peacemaker (.45)',
    values: {
      kind: 'weapon',
      damage: '2k6+1',
      range: '12/24/48',
      weight: 3,
      price: 200,
      capacity: 6,
      notes: 'SW 2015, s. 57; PP 1, rewolwer; amunicja osobno',
    },
  },
  {
    name: 'Ruger (.22)',
    values: {
      kind: 'weapon',
      damage: '2k6−1',
      range: '10/20/40',
      weight: 2,
      price: 100,
      capacity: 9,
      notes: 'SW 2015, s. 57; Dublet; amunicja osobno',
    },
  },
  {
    name: 'Dwururka (12g)',
    values: {
      kind: 'weapon',
      damage: '1–3k6',
      range: '12/24/48',
      weight: 11,
      price: 150,
      capacity: 2,
      notes: 'SW 2015, s. 58; SzS 1–2; amunicja osobno',
    },
  },
  {
    name: 'Karabin Spencera (.52)',
    values: {
      kind: 'weapon',
      damage: '2k8',
      range: '20/40/80',
      weight: 8,
      price: 250,
      capacity: 7,
      notes: 'SW 2015, s. 58; PP 2; amunicja osobno',
    },
  },
  { name: 'Plecak', values: { weight: 2, price: 50, notes: 'SW 2015, s. 60' } },
  {
    name: 'Manierka',
    values: { weight: 1, price: 5, notes: 'SW 2015, s. 60; wodę zapisz osobno' },
  },
  { name: 'Latarka', values: { weight: 3, price: 20, notes: 'SW 2015, s. 60' } },
  { name: 'Posłanie / śpiwór', values: { weight: 4, price: 25, notes: 'SW 2015, s. 60' } },
  {
    name: 'Racja żywnościowa (5 porcji)',
    values: { weight: 5, price: 10, notes: 'SW 2015, s. 60' },
  },
  { name: 'Zestaw narzędzi', values: { weight: 5, price: 200, notes: 'SW 2015, s. 60' } },
  { name: 'Lina (10 cali skali gry)', values: { weight: 15, price: 10, notes: 'SW 2015, s. 60' } },
];
export const equipmentItem = (index: number): Item => ({
  ...newItem(),
  ...equipment[index].values,
  name: equipment[index].name,
});

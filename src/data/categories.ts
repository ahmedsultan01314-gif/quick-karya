import { ServiceCategory } from '../types';

export interface CategoryInfo {
  id: ServiceCategory;
  name: ServiceCategory;
  hindiName: string;
  description: string;
  iconName: string;
  avgRate: string;
  badge?: string;
  emergencyPriority?: boolean;
}

export const CATEGORIES: CategoryInfo[] = [
  {
    id: 'Plumber',
    name: 'Plumber',
    hindiName: 'प्लंबर / नलसाज',
    description: 'Pipe fittings, water leakage, tap repair, bathroom sanitary installations, motor servicing.',
    iconName: 'Wrench',
    avgRate: 'Direct Dial Contact'
  },
  {
    id: 'Electrician',
    name: 'Electrician',
    hindiName: 'इलेक्ट्रीशियन / बिजली मिस्त्री',
    description: 'Wiring, MCB tripping, fan repair, inverter connection, appliance installation & fixes.',
    iconName: 'Zap',
    avgRate: 'Direct Dial Contact'
  },
  {
    id: 'Carpenter',
    name: 'Carpenter',
    hindiName: 'बढ़ई / कारपेंटर',
    description: 'Door & lock repairs, modular furniture fitting, wooden cabinetry, polishing & restoration.',
    iconName: 'Hammer',
    avgRate: 'Direct Dial Contact'
  },
  {
    id: 'Cook',
    name: 'Cook',
    hindiName: 'रसोइया / कुक',
    description: 'Home food preparation, party catering, North & South Indian meals, hygienic cook services.',
    iconName: 'UtensilsCrossed',
    avgRate: 'Direct Dial Contact'
  },
  {
    id: 'Painter',
    name: 'Painter',
    hindiName: 'पेंटर / पुताई कारीगर',
    description: 'Interior & exterior wall painting, waterproof putty, texture designs, touch-up painting.',
    iconName: 'Paintbrush',
    avgRate: 'Direct Dial Contact'
  },
  {
    id: 'Driver',
    name: 'Driver',
    hindiName: 'ड्राइवर / वाहन चालक',
    description: 'Commercial & personal car drivers, outstation travel, hourly city transit, verified license holders.',
    iconName: 'Car',
    avgRate: 'Direct Dial Contact'
  },
  {
    id: 'Rajmistri / Mason',
    name: 'Rajmistri / Mason',
    hindiName: 'राजमिस्त्री / चिनाई कारीगर',
    description: 'Brickwork, tile setting, concrete plastering, slab casting, structural repair & masonry.',
    iconName: 'HardHat',
    avgRate: 'Direct Dial Contact'
  },
  {
    id: 'Labour / Helper',
    name: 'Labour / Helper',
    hindiName: 'मजदूर / सहायक हेल्पर',
    description: 'Loading & unloading, shifting assistance, construction site help, gardening & manual work.',
    iconName: 'Users',
    avgRate: 'Direct Dial Contact'
  },
  {
    id: 'Welder',
    name: 'Welder',
    hindiName: 'वेल्डर / वेल्डिंग कारीगर',
    description: 'Iron gate welding, window grills, structural steel fabrication, metal frame repairs & ARC/MIG welding.',
    iconName: 'Flame',
    avgRate: 'Direct Dial Contact'
  },
  {
    id: 'Pest Control',
    name: 'Pest Control',
    hindiName: 'कीट नियंत्रण / पेस्ट कंट्रोल',
    description: 'Cockroach control, anti-termite drilling treatment, bed bug eradication, rodent & sanitization disinfection services.',
    iconName: 'Bug',
    avgRate: 'Direct Dial Contact'
  },
  {
    id: 'Laundry / Clothes Wash',
    name: 'Laundry / Clothes Wash',
    hindiName: 'धोबी / कपड़े धुलाई व इस्त्री',
    description: 'Washing machine laundry, clothes wash, steam ironing, dry cleaning drop-off & doorstep pickup.',
    iconName: 'Shirt',
    avgRate: 'Direct Dial Contact'
  },
  {
    id: 'Hotel Staff',
    name: 'Hotel Staff',
    hindiName: 'होटल स्टाफ / रूम सर्विस',
    description: 'Hotel receptionists, room housekeeping, hospitality helpers, cleaning & bell desk support.',
    iconName: 'Building2',
    avgRate: 'Direct Dial Contact'
  },
  {
    id: 'Restaurant Staff',
    name: 'Restaurant Staff',
    hindiName: 'रेस्टोरेंट स्टाफ / वेटर व रसोइया',
    description: 'Restaurant waiters, chefs, commercial cooks, table servers, kitchen helpers & pantry staff.',
    iconName: 'Utensils',
    avgRate: 'Direct Dial Contact'
  },
  {
    id: 'Emergency Highway Assistance',
    name: 'Emergency Highway Assistance',
    hindiName: 'आपातकालीन हाईवे सहायता',
    description: '24/7 on-spot highway rescue: flat tyre repair, jump start, fuel delivery, towing support & winching.',
    iconName: 'ShieldAlert',
    avgRate: 'Direct Dial Contact',
    badge: '24/7 Urgent',
    emergencyPriority: true
  }
];

export const CATEGORY_SUB_ROLES: Partial<Record<ServiceCategory, string[]>> = {
  'Laundry / Clothes Wash': ['Laundry Person', 'Ironing', 'Helper'],
  'Hotel Staff': ['Receptionist', 'Housekeeping', 'Helper'],
  'Restaurant Staff': ['Waiter', 'Chef/Cook', 'Helper']
};

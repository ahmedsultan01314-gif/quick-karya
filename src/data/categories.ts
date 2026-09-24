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
    avgRate: '₹250 - ₹450/hr'
  },
  {
    id: 'Electrician',
    name: 'Electrician',
    hindiName: 'इलेक्ट्रीशियन / बिजली मिस्त्री',
    description: 'Wiring, MCB tripping, fan repair, inverter connection, appliance installation & fixes.',
    iconName: 'Zap',
    avgRate: '₹200 - ₹400/hr'
  },
  {
    id: 'Carpenter',
    name: 'Carpenter',
    hindiName: 'बढ़ई / कारपेंटर',
    description: 'Door & lock repairs, modular furniture fitting, wooden cabinetry, polishing & restoration.',
    iconName: 'Hammer',
    avgRate: '₹300 - ₹500/hr'
  },
  {
    id: 'Cook',
    name: 'Cook',
    hindiName: 'रसोइया / कुक',
    description: 'Home food preparation, party catering, North & South Indian meals, hygienic cook services.',
    iconName: 'UtensilsCrossed',
    avgRate: '₹350 - ₹600/meal'
  },
  {
    id: 'Painter',
    name: 'Painter',
    hindiName: 'पेंटर / पुताई कारीगर',
    description: 'Interior & exterior wall painting, waterproof putty, texture designs, touch-up painting.',
    iconName: 'Paintbrush',
    avgRate: '₹250 - ₹450/hr'
  },
  {
    id: 'Driver',
    name: 'Driver',
    hindiName: 'ड्राइवर / वाहन चालक',
    description: 'Commercial & personal car drivers, outstation travel, hourly city transit, verified license holders.',
    iconName: 'Car',
    avgRate: '₹250 - ₹450/hr'
  },
  {
    id: 'Rajmistri / Mason',
    name: 'Rajmistri / Mason',
    hindiName: 'राजमिस्त्री / चिनाई कारीगर',
    description: 'Brickwork, tile setting, concrete plastering, slab casting, structural repair & masonry.',
    iconName: 'HardHat',
    avgRate: '₹500 - ₹800/day'
  },
  {
    id: 'Labour / Helper',
    name: 'Labour / Helper',
    hindiName: 'मजदूर / सहायक हेल्पर',
    description: 'Loading & unloading, shifting assistance, construction site help, gardening & manual work.',
    iconName: 'Users',
    avgRate: '₹350 - ₹550/day'
  },
  {
    id: 'Welder',
    name: 'Welder',
    hindiName: 'वेल्डर / वेल्डिंग कारीगर',
    description: 'Iron gate welding, window grills, structural steel fabrication, metal frame repairs & ARC/MIG welding.',
    iconName: 'Flame',
    avgRate: '₹350 - ₹500/hr'
  },
  {
    id: 'Pest Control',
    name: 'Pest Control',
    hindiName: 'कीट नियंत्रण / पेस्ट कंट्रोल',
    description: 'Cockroach control, anti-termite drilling treatment, bed bug eradication, rodent & sanitization disinfection services.',
    iconName: 'Bug',
    avgRate: '₹350 - ₹500/hr • ₹1,200/day'
  },
  {
    id: 'Emergency Highway Assistance',
    name: 'Emergency Highway Assistance',
    hindiName: 'आपातकालीन हाईवे सहायता',
    description: '24/7 on-spot highway rescue: flat tyre repair, jump start, fuel delivery, towing support & winching.',
    iconName: 'ShieldAlert',
    avgRate: '₹500 - ₹1200/callout',
    badge: '24/7 Urgent',
    emergencyPriority: true
  }
];

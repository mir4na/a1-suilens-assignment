import { db } from './index';
import { lenses } from './schema';

async function seed() {
    console.log('Seeding catalog data...');
    await db.insert(lenses).values([
        {
            id: '11111111-1111-1111-1111-111111111111',
            modelName: 'FE 24-70mm F2.8 GM II',
            manufacturerName: 'Sony',
            minFocalLength: 24,
            maxFocalLength: 70,
            maxAperture: '2.8',
            mountType: 'Sony E',
            dayPrice: '250000',
            weekendPrice: '600000',
            description: 'The Sony FE 24-70mm F2.8 GM II is a fast, versatile zoom lens.',
        },
        {
            id: '22222222-2222-2222-2222-222222222222',
            modelName: 'FE 70-200mm F2.8 GM OSS II',
            manufacturerName: 'Sony',
            minFocalLength: 70,
            maxFocalLength: 200,
            maxAperture: '2.8',
            mountType: 'Sony E',
            dayPrice: '350000',
            weekendPrice: '800000',
            description: 'The Sony FE 70-200mm F2.8 GM OSS II is a telephoto zoom lens.',
        },
    ]);
    console.log('Seeding complete!');
    process.exit(0);
}

seed().catch((err) => {
    console.error('Seeding failed:', err);
    process.exit(1);
});

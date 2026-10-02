import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

const CATEGORIES: { slug: string; name: string }[] = [
  { slug: "home", name: "Home & Household" },
  { slug: "errands", name: "Errands & Deliveries" },
  { slug: "travel", name: "Travel & Bookings" },
  { slug: "finance", name: "Finance & Admin" },
  { slug: "lifestyle", name: "Lifestyle & Wellness" },
];

const TASKS: { slug: string; name: string; description: string; category: string }[] = [
  // Home & Household
  { slug: "home-cleaning", name: "Home Cleaning", description: "Book trusted cleaners for your home.", category: "home" },
  { slug: "appliance-repair", name: "Appliance Repair", description: "Fix any faulty home appliance.", category: "home" },
  { slug: "plumbing", name: "Plumbing", description: "Leaks, blockages, and installations.", category: "home" },
  { slug: "electrician", name: "Electrician", description: "Wiring, fittings and electrical repairs.", category: "home" },
  { slug: "pest-control", name: "Pest Control", description: "Rid your home of unwanted guests.", category: "home" },

  // Errands & Deliveries
  { slug: "grocery", name: "Grocery Shopping", description: "Weekly groceries delivered to your door.", category: "errands" },
  { slug: "medicine", name: "Medicine Pickup", description: "Prescriptions picked up and delivered.", category: "errands" },
  { slug: "courier", name: "Courier & Parcels", description: "Send and receive parcels effortlessly.", category: "errands" },
  { slug: "document-delivery", name: "Document Delivery", description: "Hand-deliver documents across the city.", category: "errands" },
  { slug: "gift-wrapping", name: "Gift Shopping", description: "Curated gift shopping and delivery.", category: "errands" },

  // Travel & Bookings
  { slug: "flight-booking", name: "Flight Bookings", description: "Find and book flights that fit you.", category: "travel" },
  { slug: "hotel-booking", name: "Hotel Bookings", description: "Vetted stays booked on your behalf.", category: "travel" },
  { slug: "cab-booking", name: "Cab & Transfers", description: "Reliable rides and airport transfers.", category: "travel" },
  { slug: "visa-help", name: "Visa Assistance", description: "Guided visa paperwork and submission.", category: "travel" },
  { slug: "itinerary", name: "Trip Itinerary", description: "Hand-crafted travel plans end to end.", category: "travel" },

  // Finance & Admin
  { slug: "bill-payments", name: "Bill Payments", description: "Never miss a utility or subscription bill.", category: "finance" },
  { slug: "tax-filing", name: "Tax Filing Help", description: "Organise and file your taxes on time.", category: "finance" },
  { slug: "insurance", name: "Insurance Renewals", description: "Compare and renew policies.", category: "finance" },
  { slug: "govt-paperwork", name: "Govt Paperwork", description: "PAN, Aadhaar, passport and more.", category: "finance" },

  // Lifestyle & Wellness
  { slug: "fitness", name: "Fitness Trainer", description: "Book sessions with certified trainers.", category: "lifestyle" },
  { slug: "salon-at-home", name: "Salon at Home", description: "Beauty services at your doorstep.", category: "lifestyle" },
  { slug: "doctor-visit", name: "Doctor Consultation", description: "In-person or online consultations.", category: "lifestyle" },
  { slug: "event-planning", name: "Event Planning", description: "Birthdays, anniversaries and parties.", category: "lifestyle" },
];

async function main() {
  for (const c of CATEGORIES) {
    await prisma.category.upsert({
      where: { slug: c.slug },
      update: { name: c.name },
      create: c,
    });
  }

  const bySlug = Object.fromEntries(
    (await prisma.category.findMany()).map((c) => [c.slug, c.id])
  );

  for (const t of TASKS) {
    const categoryId = bySlug[t.category];
    if (!categoryId) continue;
    await prisma.task.upsert({
      where: { slug: t.slug },
      update: { name: t.name, description: t.description, categoryId },
      create: {
        slug: t.slug,
        name: t.name,
        description: t.description,
        categoryId,
      },
    });
  }

  // eslint-disable-next-line no-console
  console.log(`Seeded ${CATEGORIES.length} categories and ${TASKS.length} tasks.`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());

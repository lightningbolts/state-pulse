import Link from 'next/link';

const learnCards = [
	{
		href: '/learn/legislation',
		icon: '',
		title: 'What is Legislation?',
		desc: 'How laws are made, types of legislation, and the journey from idea to law.',
		color: 'bg-yellow-50 border-yellow-200',
	},
	{
		href: '/learn/chambers',
		icon: '',
		title: 'How Chambers Work',
		desc: 'Understand the House, Senate, and state legislatures—roles, structure, and process.',
		color: 'bg-blue-50 border-blue-200',
	},
	{
		href: '/learn/faq',
		icon: '',
		title: 'FAQ',
		desc: 'Answers to common questions about StatePulse and the legislative process.',
		color: 'bg-green-50 border-green-200',
	},
];

export default function LearnLandingPage() {
	return (
		<main className="max-w-5xl mx-auto py-12 px-4 md:px-0">
			<section className="mb-10 text-center">
				<h1 className="font-headline text-4xl md:text-5xl font-bold mb-3 text-primary">
					Learn
				</h1>
				<p className="text-muted-foreground text-lg md:text-xl max-w-2xl mx-auto">
					Demystify the legislative process. Explore how laws are made, how
					government chambers work, and get answers to your questions—all in one
					place.
				</p>
			</section>
			<section>
				<div className="grid grid-cols-1 md:grid-cols-3 gap-8">
					{learnCards.map(card => (
						<Link
							key={card.href}
							href={card.href}
							className={`group rounded-2xl border ${card.color} hover:bg-primary/10 transition p-8 flex flex-col items-center shadow-md hover:shadow-lg`}
						>
							<span className="text-4xl mb-4">{card.icon}</span>
							<h2 className="font-semibold text-xl mb-2 group-hover:text-primary transition text-center">
								{card.title}
							</h2>
							<p className="text-muted-foreground text-sm text-center mb-2">
								{card.desc}
							</p>
							<span className="mt-auto text-primary text-xs font-medium group-hover:underline">
								Explore →
							</span>
						</Link>
					))}
				</div>
			</section>
		</main>
	);
}

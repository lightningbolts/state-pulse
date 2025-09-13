import Link from 'next/link';
import { AnimatedSection } from '@/components/ui/AnimatedSection';

export default function LearnChambersPage() {
  return (
    <main className="max-w-3xl mx-auto py-12 px-4 md:px-0">
      <AnimatedSection>
        <h1 className="font-headline text-3xl md:text-4xl font-bold mb-4 text-primary">How Chambers Work</h1>
      </AnimatedSection>
      
      <AnimatedSection>
        <div className="prose prose-lg max-w-none text-muted-foreground mb-8 space-y-6">
        <p>
          The United States Congress is a <strong>bicameral legislature</strong>, meaning it is divided into two separate chambers: the House of Representatives and the Senate. This structure was established by the Constitution to balance the interests of both populous and less populous states, and to provide a system of checks and balances within the legislative branch (<a href="https://en.wikipedia.org/wiki/United_States_Congress" target="_blank" rel="noopener noreferrer">Wikipedia</a>).
        </p>
        <p>
          <strong>The House of Representatives</strong> is composed of 435 voting members, each representing a congressional district based on population. Members serve two-year terms, and the entire House is up for election every two years. The House is responsible for initiating revenue bills and has the sole power to impeach federal officials. Its leadership is headed by the Speaker of the House, who is elected by the members (<a href="https://en.wikipedia.org/wiki/United_States_House_of_Representatives" target="_blank" rel="noopener noreferrer">Wikipedia</a>).
        </p>
        <p>
          <strong>The Senate</strong> consists of 100 members, with each state represented by two senators regardless of population. Senators serve six-year terms, with elections staggered so that approximately one-third of the Senate is up for election every two years. The Senate has unique powers, including confirming presidential appointments, ratifying treaties, and conducting impeachment trials (<a href="https://en.wikipedia.org/wiki/United_States_Senate" target="_blank" rel="noopener noreferrer">Wikipedia</a>).
        </p>
        <p>
          Both chambers must agree on the text of a bill for it to become law. This often requires negotiation and compromise, especially when the House and Senate are controlled by different political parties. <strong>Conference committees</strong>, composed of members from both chambers, are sometimes formed to reconcile differences in legislation (<a href="https://en.wikipedia.org/wiki/Procedures_of_the_United_States_Congress" target="_blank" rel="noopener noreferrer">Wikipedia</a>).
        </p>
        <p>
          The design of the bicameral system was influenced by the British Parliament and by the framers’ desire to prevent any single group from gaining too much power. The Senate was intended to represent the states as sovereign entities, while the House was designed to represent the people directly. This dual structure helps ensure that legislation is carefully considered from multiple perspectives (<a href="https://www.britannica.com/topic/United-States-Congress" target="_blank" rel="noopener noreferrer">Britannica</a>).
        </p>
        <p>
          In addition to the federal Congress, most U.S. states have their own bicameral legislatures, typically called the House (or Assembly) and Senate. Nebraska is the only state with a unicameral (single-chamber) legislature. State legislatures perform similar functions to Congress, including passing state laws, approving budgets, and overseeing the executive branch (<a href="https://en.wikipedia.org/wiki/List_of_U.S._state_legislatures" target="_blank" rel="noopener noreferrer">Wikipedia</a>).
        </p>
        <p>
          Understanding how the House and Senate work is essential for grasping the legislative process and the broader system of American government. The bicameral structure fosters debate, negotiation, and compromise, which are vital to the functioning of a healthy democracy (<a href="https://en.wikipedia.org/wiki/United_States_Congress" target="_blank" rel="noopener noreferrer">Wikipedia</a>).
        </p>
        </div>
      </AnimatedSection>
      
      <AnimatedSection>
        <div className="mb-8 flex flex-col items-center">
        <a
          href="https://commons.wikimedia.org/wiki/File:Branches_US_gov.jpg"
          target="_blank"
          rel="noopener noreferrer"
          className="block mb-2"
        >
          <img
            src="https://upload.wikimedia.org/wikipedia/commons/6/6d/Branches_US_gov.jpg"
            alt="Diagram of the branches of the US government (Wikimedia Commons)"
            width={600}
            height={350}
            className="rounded-lg border shadow"
            loading="lazy"
          />
        </a>
        <span className="text-xs text-muted-foreground">Source: <Link href="https://commons.wikimedia.org/wiki/File:Branches_US_gov.jpg" className="underline">Wikimedia Commons</Link></span>
        </div>
      </AnimatedSection>
      
      <AnimatedSection>
        <div className="mt-8">
        <h2 className="font-semibold text-xl mb-2 text-primary">State Legislatures</h2>
        <p className="text-base">
          Most states also have bicameral legislatures (House/Assembly and Senate), with similar roles and processes. Nebraska is the only state with a single-chamber (unicameral) legislature.
        </p>
        </div>
      </AnimatedSection>
    </main>
  );
}
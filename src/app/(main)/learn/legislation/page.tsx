import Link from 'next/link';
import { AnimatedSection } from '@/components/ui/AnimatedSection';

export default function LearnLegislationPage() {
  return (
    <main className="max-w-3xl mx-auto py-12 px-4 md:px-0">
      <AnimatedSection>
        <h1 className="font-headline text-3xl md:text-4xl font-bold mb-4 text-primary">What is Legislation?</h1>
      </AnimatedSection>
      
      <AnimatedSection>
        <div className="prose prose-lg max-w-none text-muted-foreground mb-8 space-y-6">
        <p>
          <strong>Legislation</strong> is the process by which laws are created, amended, or repealed by a governing body such as a legislature or parliament. In the United States, legislation typically begins as a bill—a formal proposal for a new law or a change to existing law. The process of turning a bill into law is fundamental to representative democracy, ensuring that the rules governing society are debated and decided by elected officials (<a href="https://en.wikipedia.org/wiki/Legislation" target="_blank" rel="noopener noreferrer">Wikipedia</a>).
        </p>
        <p>
          <strong>Drafting and Introduction:</strong> The journey of a bill starts with its drafting, which can be initiated by members of Congress, state legislators, the executive branch, or even advocacy groups and citizens. Drafting a bill requires careful attention to legal language, definitions, and the intended impact of the proposed law. Once drafted, the bill is introduced in either the House of Representatives or the Senate, where it is assigned a number and referred to a relevant committee for further consideration (<a href="https://en.wikipedia.org/wiki/Bill_(law)" target="_blank" rel="noopener noreferrer">Wikipedia</a>).
        </p>
        <p>
          <strong>Committee Review:</strong> Committees play a crucial role in the legislative process. They review the bill in detail, hold hearings to gather expert and public input, and may propose amendments. This stage is often where most bills are altered, improved, or even halted. If the committee approves the bill, it moves to the floor of the chamber for debate and voting. Here, all members can discuss the bill, suggest further amendments, and ultimately vote on its passage (<a href="https://www.congress.gov/resources/display/content/How+Our+Laws+Are+Made" target="_blank" rel="noopener noreferrer">Congress.gov</a>).
        </p>
        <p>
          <strong>Chamber Consideration and Passage:</strong> If the bill passes one chamber, it is sent to the other (House or Senate), where the process repeats. Both chambers must agree on the final text. If there are differences, a conference committee made up of members from both chambers works to reconcile them. The revised bill is then sent back to both chambers for a final vote. This system of checks and balances ensures that legislation is thoroughly vetted and debated before becoming law (<a href="https://en.wikipedia.org/wiki/Procedures_of_the_United_States_Congress" target="_blank" rel="noopener noreferrer">Wikipedia</a>).
        </p>
        <p>
          <strong>Executive Action:</strong> Once both chambers have passed the same version of the bill, it is sent to the President (or a state governor for state laws). The executive can sign the bill into law or veto it. In the case of a veto, Congress can override the decision with a two-thirds majority in both chambers. Some bills may also be subject to judicial review or, in rare cases, a public referendum (<a href="https://en.wikipedia.org/wiki/Veto" target="_blank" rel="noopener noreferrer">Wikipedia</a>).
        </p>
        <p>
          <strong>Becoming Law and Beyond:</strong> After a bill becomes law, it may take effect immediately or on a specified date. The new law is published in an official gazette and becomes enforceable. Over time, laws may be amended, repealed, or become obsolete—a phenomenon known as "dead letter" legislation. The ongoing process of legislation reflects the evolving needs and values of society (<a href="https://en.wikipedia.org/wiki/Dead_letter" target="_blank" rel="noopener noreferrer">Wikipedia</a>).
        </p>
        <p>
          <strong>Why Legislation Matters:</strong> Legislation is a cornerstone of democratic governance, providing the framework for order, justice, and the protection of rights. It is shaped by public participation, expert input, and the deliberative process of elected representatives. Understanding how legislation works empowers citizens to engage with their government and advocate for change.
        </p>
        </div>
      </AnimatedSection>
      
      <AnimatedSection>
        <div className="mb-8 flex flex-col items-center">
        <a
          href="https://commons.wikimedia.org/wiki/File:Visualization-of-How-a-Bill-Becomes-a-Law_Mike-WIRTH.jpg"
          target="_blank"
          rel="noopener noreferrer"
          className="block mb-2"
        >
          <img
            src="https://upload.wikimedia.org/wikipedia/commons/2/2b/Visualization-of-How-a-Bill-Becomes-a-Law_Mike-WIRTH.jpg"
            alt="How a Bill Becomes a Law infographic (Mike Wirth, Wikimedia Commons)"
            width={700}
            height={400}
            className="rounded-lg border shadow"
            loading="lazy"
          />
        </a>
        <span className="text-xs text-muted-foreground">Source: <Link href="https://commons.wikimedia.org/wiki/File:Visualization-of-How-a-Bill-Becomes-a-Law_Mike-WIRTH.jpg" className="underline">Wikimedia Commons</Link></span>
        </div>
      </AnimatedSection>
    </main>
  );
}
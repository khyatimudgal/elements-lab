export type Preset = {
    id: string;
    label: string;
    blurb: string;
    source: string;
};

const WELCOME = `import {
  Row, Column, Heading, Paragraph, Button, Image,
} from '@unlayer/react-elements';

export const config = {
  backgroundColor: '#eef2f7',
  contentWidth: '600px',
};

const firstName = '{{ first_name }}';
const hero = 'https://picsum.photos/seed/a/600/200';

export default function Content() {
  return (
    <>
      <Row>
        <Column>
          <Image src={hero} alt="A team at work" />
        </Column>
      </Row>
      <Row>
        <Column>
          <Heading color="#0f172a" fontSize="28px">
            Welcome aboard, {firstName}
          </Heading>
          <Paragraph color="#334155">
            Your workspace is ready. Invite a
            teammate and start shipping today.
          </Paragraph>
          <Button
            href="https://example.com/start"
            backgroundColor="#1d4ed8"
            color="#ffffff"
          >
            Open your workspace
          </Button>
        </Column>
      </Row>
    </>
  );
}
`;

const RECEIPT = `import { Row, Column, Heading, Paragraph, Divider, Table } from '@unlayer/react-elements';

export const config = { backgroundColor: '#ffffff', contentWidth: '600px' };

const firstName = '{{ first_name }}';

export default function Content() {
  return (
    <>
      <Row>
        <Column>
          <Heading color="#111827" fontSize="26px">
            Receipt for order #1042
          </Heading>
          <Paragraph color="#4b5563">
            Thanks, {firstName}. Here is your copy for the accountant.
          </Paragraph>
          <Divider />
        </Column>
      </Row>
      <Row>
        <Column>
          <Table
            headers={['Item', 'Qty', 'Total']}
            data={[
              ['Standard plan, annual', '1', '$240.00'],
              ['Extra seats', '3', '$108.00'],
              ['Tax', '', '$34.80'],
            ]}
          />
          <Divider />
          <Paragraph color="#111827" fontSize="18px" fontWeight="bold">
            Paid in full: $382.80
          </Paragraph>
        </Column>
      </Row>
    </>
  );
}
`;

const BROKEN = `import { Row, Column, Heading, Paragraph, Button, Image } from '@unlayer/react-elements';

export const config = { backgroundColor: '#ffffff', contentWidth: '600px' };

const badTag = '{{ first name }}';
const unclosedTag = '{{ expires_at';

export default function Content() {
  return (
    <>
      <Row>
        <Column>
          <Image src="https://picsum.photos/seed/broken/600/200" />

          <Heading color="#c8d4e8" fontSize="26px">
            Can you read this heading?
          </Heading>

          <Paragraph color="#b9c4d4">
            Hello {badTag}, your trial ends on {unclosedTag}.
          </Paragraph>

          <Button href="#" backgroundColor="#dbe4f0" color="#ffffff">
            Upgrade now
          </Button>

          <Button href="http://example.com/terms" backgroundColor="#64748b" color="#ffffff">
            Read the terms
          </Button>
        </Column>
      </Row>
    </>
  );
}
`;

const NEWSLETTER = `import { Row, Column, Heading, Paragraph, Divider, Social } from '@unlayer/react-elements';

export const config = { backgroundColor: '#fdf6ec', contentWidth: '600px' };

export default function Content() {
  return (
    <>
      <Row>
        <Column>
          <Heading color="#1c1917" fontSize="30px">
            The Weekly Build
          </Heading>
          <Paragraph color="#57534e">
            Issue 14 · What we shipped, what broke, and what we learned.
          </Paragraph>
          <Divider />
        </Column>
      </Row>
      <Row>
        <Column>
          <Heading color="#1c1917" fontSize="20px">
            One tree, three destinations
          </Heading>
          <Paragraph color="#44403c">
            Switch the tabs above. The same component renders as table-based
            email, a responsive page, and a print-ready document.
          </Paragraph>
          <Social
            icons={[{ name: 'GitHub', url: 'https://github.com/unlayer/elements' }]}
            iconType="rounded"
          />
        </Column>
      </Row>
    </>
  );
}
`;

export const PRESETS: ReadonlyArray<Preset> = [
    { id: 'welcome', label: 'Welcome', blurb: 'A clean transactional email', source: WELCOME },
    { id: 'receipt', label: 'Receipt', blurb: 'Shines as email, page and PDF', source: RECEIPT },
    { id: 'newsletter', label: 'Newsletter', blurb: 'Longer editorial layout', source: NEWSLETTER },
    { id: 'broken', label: 'Broken on purpose', blurb: 'Trips every audit check', source: BROKEN },
];

export const DEFAULT_SOURCE = WELCOME;

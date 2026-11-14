"use client";

import { useState } from "react";
import {
  Badge,
  Box,
  Button,
  CentrePicker,
  Checkbox,
  ConfirmDialog,
  DateStrip,
  Dialog,
  EmptyState,
  ErrorState,
  FormField,
  Input,
  LoadMore,
  PageHeader,
  RadioGroup,
  RoleBadge,
  Select,
  SidePanel,
  Skeleton,
  SlotGrid,
  Stars,
  StatusBadge,
  Switch,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
  Tabs,
  Textarea,
  Toast,
  TokenNumber,
} from "@/components/ui";

const centres = [
  { id: "sample-centre", name: "Sample centre" },
  { id: "another-centre", name: "Another centre" },
];

export function StyleguidePage() {
  const [dialogOpen, setDialogOpen] = useState(false);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [panelOpen, setPanelOpen] = useState(false);
  const [radio, setRadio] = useState("student");
  const [date, setDate] = useState("2026-11-16");
  const [slot, setSlot] = useState("10:00");
  const [rating, setRating] = useState(3);
  const [centre, setCentre] = useState("sample-centre");
  const [query, setQuery] = useState("");

  return (
    <main className="page-width app-main">
      <PageHeader title="Styleguide" description="Base components and states." />

      <section className="styleguide-section stack">
        <h2 className="section-title">Button</h2>
        <div className="row">
          <Button>Primary</Button>
          <Button variant="secondary">Secondary</Button>
          <Button variant="ghost">Ghost</Button>
          <Button variant="danger">Danger</Button>
          <Button disabled>Disabled</Button>
          <Button size="student">Student size</Button>
        </div>
      </section>

      <section className="styleguide-section stack">
        <h2 className="section-title">Input and Textarea</h2>
        <div className="styleguide-grid">
          <FormField id="sample-input" label="Input" hint="Hint text">
            <Input id="sample-input" placeholder="Enter a value" />
          </FormField>
          <FormField id="sample-input-invalid" label="Invalid input" error="This field is required.">
            <Input id="sample-input-invalid" aria-invalid="true" value="" readOnly />
          </FormField>
          <FormField id="sample-input-disabled" label="Disabled input">
            <Input id="sample-input-disabled" value="Read only" disabled readOnly />
          </FormField>
          <FormField id="sample-textarea" label="Textarea">
            <Textarea id="sample-textarea" placeholder="Add a note" />
          </FormField>
          <FormField id="sample-textarea-disabled" label="Disabled textarea">
            <Textarea id="sample-textarea-disabled" value="Read only" disabled readOnly />
          </FormField>
          <FormField id="sample-select-disabled" label="Disabled select">
            <Select id="sample-select-disabled" disabled defaultValue="student">
              <option value="student">Student</option>
            </Select>
          </FormField>
        </div>
      </section>

      <section className="styleguide-section stack">
        <h2 className="section-title">Select, Checkbox, Switch and RadioGroup</h2>
        <div className="styleguide-grid">
          <FormField id="sample-select" label="Select">
            <Select id="sample-select" defaultValue="student">
              <option value="student">Student</option>
              <option value="faculty">Faculty or staff</option>
            </Select>
          </FormField>
          <div className="stack stack--small">
            <Checkbox label="Unchecked checkbox" checked={false} readOnly />
            <Checkbox label="Checked checkbox" checked readOnly />
            <Switch label="Switch off" checked={false} onCheckedChange={() => undefined} />
            <Switch label="Switch on" checked onCheckedChange={() => undefined} />
          </div>
          <RadioGroup
            name="styleguide-account"
            value={radio}
            onValueChange={setRadio}
            options={[
              { value: "student", label: "Student" },
              { value: "faculty", label: "Faculty or staff", disabled: true },
            ]}
          />
        </div>
      </section>

      <section className="styleguide-section stack">
        <h2 className="section-title">FormField and badges</h2>
        <FormField id="sample-field" label="Field label" hint="A short hint." error="A field error.">
          <Input id="sample-field" aria-invalid="true" />
        </FormField>
        <div className="row">
          <Badge>Confidential</Badge>
          <RoleBadge role="app_admin" />
          <RoleBadge role="campus_authority" />
          <RoleBadge role="centre_admin" />
          <RoleBadge role="centre_staff" />
          <RoleBadge role="student_faculty" />
          <StatusBadge status="CONFIRMED" />
          <StatusBadge status="REQUESTED" />
          <StatusBadge status="IN_SERVICE" />
          <StatusBadge status="COMPLETED" />
          <StatusBadge status="REJECTED" />
          <StatusBadge status="CANCELLED" />
          <StatusBadge status="NO_SHOW" />
          <StatusBadge status="CHECKED_IN" />
        </div>
      </section>

      <section className="styleguide-section stack">
        <h2 className="section-title">Table</h2>
        <Table>
          <TableHeader>
            <TableRow><TableHead>Token</TableHead><TableHead>Status</TableHead></TableRow>
          </TableHeader>
          <TableBody>
            <TableRow><TableCell><TokenNumber>ITS-014</TokenNumber></TableCell><TableCell>Confirmed</TableCell></TableRow>
          </TableBody>
        </Table>
      </section>

      <section className="styleguide-section stack">
        <h2 className="section-title">Tabs</h2>
        <Tabs
          items={[
            { value: "first", label: "First tab", content: <p>First tab content.</p> },
            { value: "second", label: "Second tab", content: <p>Second tab content.</p> },
          ]}
        />
      </section>

      <section className="styleguide-section stack">
        <h2 className="section-title">Dialog, ConfirmDialog and SidePanel</h2>
        <div className="row">
          <Button variant="secondary" onClick={() => setDialogOpen(true)}>Open dialog</Button>
          <Button variant="secondary" onClick={() => setConfirmOpen(true)}>Open confirmation</Button>
          <Button variant="secondary" onClick={() => setPanelOpen(true)}>Open side panel</Button>
        </div>
        <Dialog open={dialogOpen} onOpenChange={setDialogOpen} title="Dialog example" description="A bordered white dialog.">
          <p>Dialog content.</p>
        </Dialog>
        <ConfirmDialog
          open={confirmOpen}
          onOpenChange={setConfirmOpen}
          title="Confirm action"
          description="This is a confirmation example."
          onConfirm={() => setConfirmOpen(false)}
        />
        <SidePanel open={panelOpen} onOpenChange={setPanelOpen} title="Side panel" description="A side panel example.">
          <p>Panel content.</p>
        </SidePanel>
      </section>

      <section className="styleguide-section stack">
        <h2 className="section-title">Skeleton, empty, error, load more and toast</h2>
        <div className="stack">
          <Skeleton />
          <EmptyState message="No records yet." action={<Button variant="secondary">Add record</Button>} />
          <ErrorState message="The request could not be completed." status={500} requestId="sample-request-id" />
          <div className="row">
            <LoadMore onClick={() => setQuery("loaded")} />
            <LoadMore onClick={() => {}} disabled />
          </div>
          {query ? <p>{query}</p> : null}
          <Toast>Changes saved.</Toast>
        </div>
      </section>

      <section className="styleguide-section stack">
        <h2 className="section-title">PageHeader, Box and TokenNumber</h2>
        <PageHeader title="Section title" description="A short description." actions={<Button variant="secondary">Action</Button>} />
        <Box title="Plain bordered box">
          <TokenNumber large>ITS-014</TokenNumber>
        </Box>
      </section>

      <section className="styleguide-section stack">
        <h2 className="section-title">DateStrip and SlotGrid</h2>
        <DateStrip
          value={date}
          onChange={setDate}
          items={[
            { date: "2026-11-16", label: "16 Nov", weekday: "Mon" },
            { date: "2026-11-17", label: "17 Nov", weekday: "Tue", disabled: true },
            { date: "2026-11-18", label: "18 Nov", weekday: "Wed" },
          ]}
        />
        <SlotGrid
          value={slot}
          onChange={setSlot}
          items={[
            { start: "09:30", label: "9:30 am", state: "available" },
            { start: "10:00", label: "10:00 am", state: "few", remaining: 2 },
            { start: "10:30", label: "10:30 am", state: "full" },
            { start: "11:00", label: "11:00 am", state: "blocked" },
            { start: "11:30", label: "11:30 am", state: "past" },
          ]}
        />
      </section>

      <section className="styleguide-section stack">
        <h2 className="section-title">Stars and CentrePicker</h2>
        <Stars value={rating} onChange={setRating} />
        <CentrePicker centres={centres} value={centre} onChange={setCentre} />
      </section>
    </main>
  );
}

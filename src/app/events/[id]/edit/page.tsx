"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import { format } from "date-fns";
import EventForm, { EventFormValues } from "@/components/EventForm";

export default function EditEventPage() {
  const params = useParams<{ id: string }>();
  const [values, setValues] = useState<EventFormValues | null>(null);
  const [notFound, setNotFound] = useState(false);

  useEffect(() => {
    fetch(`/api/events/${params.id}`)
      .then((r) => {
        if (!r.ok) throw new Error("not found");
        return r.json();
      })
      .then((event) => {
        setValues({
          title: event.title,
          type: event.type,
          description: event.description || "",
          location: event.location || "",
          startTime: format(new Date(event.startTime), "yyyy-MM-dd'T'HH:mm"),
        });
      })
      .catch(() => setNotFound(true));
  }, [params.id]);

  if (notFound) return <p className="text-slate-500">Event not found.</p>;
  if (!values) return <p className="text-slate-500">Loading...</p>;

  return <EventForm mode="edit" eventId={params.id} initialValues={values} />;
}

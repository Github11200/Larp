// Every collection in the app. Import from here rather than calling collection() elsewhere.
import { Conversation, Event, FollowUp, Person, Profile } from "@larp/shared";
import { collection } from "./store";

export const db = {
  profiles: collection("profiles", Profile),
  events: collection("events", Event),
  people: collection("people", Person),
  conversations: collection("conversations", Conversation),
  followUps: collection("followups", FollowUp),
};

export const newId = () => crypto.randomUUID();

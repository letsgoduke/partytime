import { Heart } from "lucide-react";

interface HostNoteProps {
  hostName: string;
  updates: readonly string[];
}

export function HostNote({ hostName, updates }: HostNoteProps) {
  return (
    <section className="host-note">
      <div className="note-icon">“</div>
      <div>
        <h3>A note from {hostName.split(" ")[0]}</h3>
        <p>
          {updates.at(-1) ||
            "Your company is the best contribution. Come as you are."}
        </p>
        <span>
          YOUR PRESENCE IS PLENTY. REALLY. <Heart size={12} />
        </span>
      </div>
    </section>
  );
}

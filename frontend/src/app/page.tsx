"use client";

type Step = {
  id: number;
  icon: string;
  title: string;
  type: string;
  description: string;
};

const stepTypes = [
  { icon: "🤖", title: "LLM Call", type: "llm_call", description: "Call an AI model" },
  { icon: "🌐", title: "HTTP Request", type: "http_request", description: "Call an external API" },
  { icon: "🔀", title: "Conditional Branch", type: "conditional_branch", description: "Branch based on output" },
  { icon: "🔐", title: "Approval Gate", type: "approval_gate", description: "Pause for approval" },
  { icon: "💾", title: "DB Write", type: "db_write", description: "Save workflow data" },
  { icon: "🔔", title: "Notify", type: "notify", description: "Send an alert" },
];

export default function Home() {
  return (
    <main className="min-h-screen bg-slate-950 text-white p-8">
      <h1 className="text-2xl font-bold">AI Agent Workflow Builder</h1>
      <p className="mt-1 text-sm text-slate-400">Build, run and monitor AI workflows</p>
    </main>
  );
}

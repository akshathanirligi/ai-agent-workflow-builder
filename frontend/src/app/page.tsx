"use client";

import { useState } from "react";
import { nhost } from "../../lib/nhost";

type Step = {
  id: number;
  icon: string;
  title: string;
  type: string;
  description: string;
};

const stepTypes = [
  {
    icon: "🤖",
    title: "LLM Call",
    type: "llm_call",
    description: "Call an AI model",
  },
  {
    icon: "🌐",
    title: "HTTP Request",
    type: "http_request",
    description: "Call an external API",
  },
  {
    icon: "🔀",
    title: "Conditional Branch",
    type: "conditional_branch",
    description: "Branch based on output",
  },
  {
    icon: "🔐",
    title: "Approval Gate",
    type: "approval_gate",
    description: "Pause for approval",
  },
  {
    icon: "💾",
    title: "DB Write",
    type: "db_write",
    description: "Save workflow data",
  },
  {
    icon: "🔔",
    title: "Notify",
    type: "notify",
    description: "Send an alert",
  },
];

export default function Home() {
  const [steps, setSteps] = useState<Step[]>([
    {
      id: 1,
      icon: "🤖",
      title: "Analyze Request",
      type: "llm_call",
      description: "Analyze the incoming request",
    },
    {
      id: 2,
      icon: "🌐",
      title: "Fetch Details",
      type: "http_request",
      description: "Fetch information from an API",
    },
    {
      id: 3,
      icon: "🔀",
      title: "Check Priority",
      type: "conditional_branch",
      description: "Decide based on AI output",
    },
    {
      id: 4,
      icon: "🔐",
      title: "Manager Approval",
      type: "approval_gate",
      description: "Wait for an authorized approver",
    },
  ]);

  const [saved, setSaved] = useState(false);
  const [running, setRunning] = useState(false);
  const [approvalPending, setApprovalPending] = useState(false);
const [approvalCompleted, setApprovalCompleted] = useState(false);
const [approvalRunId, setApprovalRunId] = useState<string | null>(null);

  function addStep(stepType: (typeof stepTypes)[number]) {
    const newStep: Step = {
      id: steps.length + 1,
      icon: stepType.icon,
      title: stepType.title,
      type: stepType.type,
      description: stepType.description,
    };

    setSteps([...steps, newStep]);
  }

  function removeStep(id: number) {
    setSteps(
      steps
        .filter((step) => step.id !== id)
        .map((step, index) => ({
          ...step,
          id: index + 1,
        }))
    );
  }

  async function saveWorkflow() {
    try {
      const session = nhost.getUserSession();

      if (!session) {
        alert("Please login first");
        return;
      }

      const userId = session.user?.id;

      if (!userId) {
        alert("Please login again");
        return;
      }

      const organizationId =
        "bc8ea11d-d4ab-4306-8c55-a506adb81774";

      const workflowResponse = await nhost.graphql.request({
        query: `
          mutation CreateWorkflow(
            $workflow: workflows_insert_input!
          ) {
            insert_workflows_one(object: $workflow) {
              id
              name
            }
          }
        `,
        variables: {
          workflow: {
            org_id: organizationId,
            name: "AI Agent Workflow",
            description:
              "AI workflow created from the workflow builder",
            active: true,
            created_by: userId,
          },
        },
      });

      const workflowErrors = workflowResponse.body.errors;

      if (workflowErrors && workflowErrors.length > 0) {
        console.error("Workflow errors:", workflowErrors);
        alert("Failed to save workflow");
        return;
      }

      const workflowData: any = workflowResponse.body.data;

      const workflowId =
        workflowData?.insert_workflows_one?.id;

      if (!workflowId) {
        console.error(
          "Workflow response:",
          workflowResponse.body
        );
        alert("Workflow was not created");
        return;
      }

      for (const step of steps) {
        const stepResponse = await nhost.graphql.request({
          query: `
            mutation CreateWorkflowStep(
              $step: workflow_steps_insert_input!
            ) {
              insert_workflow_steps_one(object: $step) {
                id
              }
            }
          `,
          variables: {
            step: {
              workflow_id: workflowId,
              position: step.id,
              name: step.title,
              type: step.type,
              config: {},
            },
          },
        });

        const stepErrors = stepResponse.body.errors;

        if (stepErrors && stepErrors.length > 0) {
          console.error("Step errors:", stepErrors);
          alert(
            "Workflow was created, but a step could not be saved."
          );
          return;
        }
      }

      setSaved(true);

      setTimeout(() => {
        setSaved(false);
      }, 2000);

      alert("Workflow saved successfully!");
    } catch (error) {
      console.error("Save workflow error:", error);
      alert(
        "Something went wrong while saving the workflow."
      );
    }
  }

async function runWorkflow() {
  setRunning(true);

  try {
    const session = nhost.getUserSession();

    if (!session?.user?.id) {
      alert("Please login first");
      setRunning(false);
      return;
    }

    const userId = session.user.id;

    // Get the latest workflow created by this user
    const workflowResponse = await nhost.graphql.request({
      query: `
        query GetLatestWorkflow($userId: uuid!) {
          workflows(
            where: { created_by: { _eq: $userId } }
            order_by: { created_at: desc }
            limit: 1
          ) {
            id
            workflow_steps(
              order_by: { position: asc }
            ) {
              id
              position
              name
              type
            }
          }
        }
      `,
      variables: {
        userId,
      },
    });

    const workflowBody = workflowResponse.body as {
      data?: {
        workflows?: Array<{
          id: string;
          workflow_steps: Array<{
            id: string;
            position: number;
            name: string;
            type: string;
          }>;
        }>;
      };
      errors?: Array<{
        message: string;
      }>;
    };

    if (workflowBody.errors && workflowBody.errors.length > 0) {
      console.error(workflowBody.errors);
      alert(workflowBody.errors[0].message);
      setRunning(false);
      return;
    }

    const workflow = workflowBody.data?.workflows?.[0];

    if (!workflow) {
      alert("Please save the workflow first");
      setRunning(false);
      return;
    }

    // Create workflow run
    const runResponse = await nhost.graphql.request({
      query: `
        mutation CreateWorkflowRun(
          $run: workflow_runs_insert_input!
        ) {
          insert_workflow_runs_one(object: $run) {
            id
          }
        }
      `,
      variables: {
        run: {
          workflow_id: workflow.id,
          triggered_by: userId,
          trigger_type: "manual",
          status: "paused",
          started_at: new Date().toISOString(),
        },
      },
    });

    const runBody = runResponse.body as {
      data?: {
        insert_workflow_runs_one?: {
          id: string;
        };
      };
      errors?: Array<{
        message: string;
      }>;
    };

    if (runBody.errors && runBody.errors.length > 0) {
      console.error(runBody.errors);
      alert(runBody.errors[0].message);
      setRunning(false);
      return;
    }

    const workflowRunId =
      runBody.data?.insert_workflow_runs_one?.id;

    if (!workflowRunId) {
  alert("Workflow run was not created");
  setRunning(false);
  return;
}

setApprovalRunId(workflowRunId);

setApprovalPending(
  workflow.workflow_steps.some(
    (step) => step.type === "approval_gate"
  )
);

setApprovalCompleted(false);
setApprovalRunId(workflowRunId!);

setApprovalPending(
  workflow.workflow_steps.some(
    (step) => step.type === "approval_gate"
  )
);

setApprovalCompleted(false);

    if (!workflowRunId) {
      alert("Workflow run was not created");
      setRunning(false);
      return;
    }

    // Create step runs
    for (const step of workflow.workflow_steps) {
      const stepStatus =
        step.type === "approval_gate"
          ? "paused"
          : "completed";

      const stepResponse = await nhost.graphql.request({
        query: `
          mutation CreateStepRun(
            $stepRun: step_runs_insert_input!
          ) {
            insert_step_runs_one(object: $stepRun) {
              id
            }
          }
        `,
        variables: {
          stepRun: {
            workflow_run_id: workflowRunId,
            workflow_step_id: step.id,
            status: stepStatus,
            input: {},
            output:
              stepStatus === "completed"
                ? { message: `${step.name} completed successfully` }
                : {},
            error: null,
            attempt_count: 1,
          },
        },
      });

      const stepBody = stepResponse.body as {
        data?: {
          insert_step_runs_one?: {
            id: string;
          };
        };
        errors?: Array<{
          message: string;
        }>;
      };

      if (stepBody.errors && stepBody.errors.length > 0) {
        console.error(stepBody.errors);
        alert(
          "Workflow started, but one of the steps could not be recorded."
        );
        setRunning(false);
        return;
      }
    }

    setRunning(false);

    alert("Workflow executed successfully!");
  } catch (error) {
    console.error("Run workflow error:", error);
    setRunning(false);
    alert("Something went wrong while running the workflow.");
  }
}

  async function approveWorkflow() {
    if (!approvalRunId) {
      alert("No workflow is waiting for approval.");
      return;
    }

    try {
      const response = await nhost.graphql.request({
        query: `
          mutation ApproveWorkflow($runId: uuid!) {
            update_step_runs(
              where: {
                workflow_run_id: { _eq: $runId }
                status: { _eq: "paused" }
              }
              _set: {
                status: "completed"
              }
            ) {
              affected_rows
            }

            update_workflow_runs_by_pk(
              pk_columns: { id: $runId }
              _set: {
                status: "completed"
              }
            ) {
              id
              status
            }
          }
        `,
        variables: {
          runId: approvalRunId,
        },
      });

      const body = response.body as {
        data?: unknown;
        errors?: Array<{ message: string }>;
      };

      if (body.errors && body.errors.length > 0) {
        console.error(body.errors);
        alert(body.errors[0].message);
        return;
      }

      setApprovalPending(false);
      setApprovalCompleted(true);

      alert("Workflow approved and completed!");
    } catch (error) {
      console.error("Approval error:", error);
      alert("Something went wrong while approving the workflow.");
    }
  }

  return (
    <main className="min-h-screen bg-slate-950 text-white">
      <header className="border-b border-slate-800 bg-slate-900 px-8 py-5">
        <div className="mx-auto flex max-w-7xl items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold">
              AI Agent Workflow Builder
            </h1>

            <p className="mt-1 text-sm text-slate-400">
              Build, run and monitor AI workflows
            </p>
          </div>

          <div className="flex gap-3">
            <button
              onClick={saveWorkflow}
              className="rounded-lg border border-slate-700 px-5 py-2.5 text-sm font-semibold hover:bg-slate-800"
            >
              {saved ? "✓ Saved!" : "Save Workflow"}
            </button>

            <button
              onClick={runWorkflow}
              className="rounded-lg bg-blue-600 px-5 py-2.5 text-sm font-semibold hover:bg-blue-500"
            >
              {running ? "Running..." : "▶ Run Workflow"}
            </button>
          </div>
        </div>
      </header>

      <div className="mx-auto grid max-w-7xl grid-cols-1 gap-6 p-8 lg:grid-cols-[280px_1fr_300px]">
        <aside className="rounded-xl border border-slate-800 bg-slate-900 p-5">
          <h2 className="mb-1 text-lg font-bold">
            Add Step
          </h2>

          <p className="mb-5 text-sm text-slate-400">
            Add a node to your workflow
          </p>

          <div className="space-y-3">
            {stepTypes.map((step) => (
              <button
                key={step.type}
                onClick={() => addStep(step)}
                className="flex w-full items-center gap-3 rounded-lg border border-slate-700 bg-slate-800 p-3 text-left transition hover:border-blue-500"
              >
                <span className="text-2xl">
                  {step.icon}
                </span>

                <div>
                  <p className="font-semibold">
                    {step.title}
                  </p>

                  <p className="text-xs text-slate-400">
                    {step.description}
                  </p>
                </div>

                <span className="ml-auto text-slate-400">
                  +
                </span>
              </button>
            ))}
          </div>

          <div className="mt-8 border-t border-slate-800 pt-6">
            <h3 className="font-semibold">
              Workflow Triggers
            </h3>

            <div className="mt-4 space-y-3 text-sm">
              <div className="flex items-center justify-between">
                <span>Manual trigger</span>

                <span className="rounded-full bg-green-500/20 px-3 py-1 text-xs text-green-400">
                  Enabled
                </span>
              </div>

              <div className="flex items-center justify-between">
                <span>Webhook</span>

                <span className="rounded-full bg-green-500/20 px-3 py-1 text-xs text-green-400">
                  Enabled
                </span>
              </div>
            </div>
          </div>
        </aside>

        <section className="rounded-xl border border-slate-800 bg-slate-900 p-6">
          <div className="mb-6">
            <h2 className="text-xl font-bold">
              Workflow
            </h2>

            <p className="text-sm text-slate-400">
              Configure the steps in your AI workflow
            </p>
          </div>

          <div className="space-y-3">
            {steps.map((step, index) => (
              <div key={step.id}>
                <div className="rounded-xl border border-slate-700 bg-slate-800 p-5">
                  <div className="flex items-start gap-4">
                    <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-slate-700 text-xl">
                      {step.icon}
                    </div>

                    <div className="flex-1">
                      <div className="flex items-center justify-between">
                        <div>
                          <span className="text-xs text-slate-500">
                            STEP {step.id}
                          </span>

                          <h3 className="font-bold">
                            {step.title}
                          </h3>
                        </div>

                        <button
                          onClick={() =>
                            removeStep(step.id)
                          }
                          className="text-xl text-slate-500 hover:text-red-400"
                        >
                          ×
                        </button>
                      </div>

                      <p className="mt-1 text-sm text-slate-400">
                        {step.description}
                      </p>

                      <div className="mt-3 inline-block rounded-md bg-slate-700 px-3 py-1 text-xs text-slate-300">
                        {step.type}
                      </div>
                    </div>
                  </div>
                </div>

                {index < steps.length - 1 && (
                  <div className="flex justify-center py-2 text-xl text-slate-500">
                    ↓
                  </div>
                )}
              </div>
            ))}
          </div>

          {steps.length === 0 && (
            <div className="rounded-xl border border-dashed border-slate-700 p-8 text-center">
              <p className="text-slate-400">
                No steps yet. Add a step from the left panel.
              </p>
            </div>
          )}
        </section>

        <aside className="rounded-xl border border-slate-800 bg-slate-900 p-5">
          <h2 className="text-lg font-bold">
            Latest Workflow Run
          </h2>

          <p className="mt-1 text-sm text-slate-400">
            Live step-by-step execution status
          </p>

          <div className="mt-6 space-y-4">
            <RunStatus
              icon="🤖"
              title="LLM Call"
              status="Completed"
            />

            <RunStatus
              icon="🌐"
              title="HTTP Request"
              status="Completed"
            />

            <RunStatus
              icon="🔀"
              title="Conditional"
              status="Completed"
            />

            <RunStatus
              icon="🔐"
              title="Approval Gate"
              status={
                approvalCompleted
                  ? "Completed"
                  : "Paused — awaiting approval"
              }
              paused={!approvalCompleted}
            />

            {approvalPending && !approvalCompleted && (
              <button
                onClick={approveWorkflow}
                className="mt-3 w-full rounded-lg bg-green-600 px-4 py-2 text-sm font-semibold hover:bg-green-500"
              >
                ✓ Approve Workflow
              </button>
            )}
          </div>

          <div className="mt-8 rounded-lg bg-slate-800 p-4">
            <p className="text-xs text-slate-400">
              WORKFLOW EXECUTIONS
            </p>

            <p className="mt-1 text-2xl font-bold">
              12 / 100
            </p>

            <p className="mt-1 text-xs text-slate-500">
              Usage this month
            </p>
          </div>
        </aside>
      </div>
    </main>
  );
}

function RunStatus({
  icon,
  title,
  status,
  paused = false,
}: {
  icon: string;
  title: string;
  status: string;
  paused?: boolean;
}) {
  return (
    <div className="flex items-start gap-3">
      <div
        className={`mt-1 text-lg ${
          paused ? "text-yellow-400" : "text-green-400"
        }`}
      >
        {paused ? "⏸" : "✓"}
      </div>

      <div className="flex-1">
        <div className="flex items-center gap-2">
          <span>{icon}</span>

          <span className="font-semibold">
            {title}
          </span>
        </div>

        <p
          className={`mt-1 text-sm ${
            paused
              ? "text-yellow-400"
              : "text-slate-400"
          }`}
        >
          {status}
        </p>
      </div>
    </div>
  );
}

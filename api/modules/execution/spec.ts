export const VALID_TASK_STATUSES = ['open', 'in-progress', 'done', 'closed'] as const;
export type TaskStatus = (typeof VALID_TASK_STATUSES)[number];

// Structural validity for PATCH /execution/tasks/:id — status must be one of the
// fixed lifecycle values. 'closed' stays the terminal value so existing dashboard
// queries (status <> 'closed') keep working unchanged.
export const isValid = (status: unknown): void => {
    if (typeof status !== 'string' || !(VALID_TASK_STATUSES as readonly string[]).includes(status)) {
        throw new Error(`status must be one of ${VALID_TASK_STATUSES.join(', ')}; got ${JSON.stringify(status)}`);
    }
};

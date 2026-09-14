type LiveResult = {
  candidate_id: number;
  name: string;
  manifesto?: string | null;
  photo?: string | null;
  votes: number;
  percentage: number;
};

type LiveResultsProps = {
  results: LiveResult[];
  totalVotes: number;
  loading?: boolean;
};

export default function LiveResults({
  results,
  totalVotes,
  loading = false,
}: LiveResultsProps) {
  return (
    <section className="results-card">
      <div className="results-header">
        <div>
          <p className="eyebrow">
            Live results
          </p>

          <h2>
            Current standings
          </h2>
        </div>

        <strong>
          {totalVotes}{" "}
          {totalVotes === 1
            ? "vote"
            : "votes"}
        </strong>
      </div>

      {loading && (
        <p>
          Updating results...
        </p>
      )}

      {!loading &&
        results.length === 0 && (
          <p>
            No votes have been recorded yet.
          </p>
        )}

      {results.map((result) => (
        <div
          className="result-row"
          key={result.candidate_id}
        >
          <div className="result-info">
            <strong>
              {result.name}
            </strong>

            <span>
              {result.votes}{" "}
              {result.votes === 1
                ? "vote"
                : "votes"}{" "}
              · {result.percentage}%
            </span>
          </div>

          <div className="progress">
            <div
              className="progress-bar"
              style={{
                width: `${result.percentage}%`,
              }}
            />
          </div>
        </div>
      ))}
    </section>
  );
}


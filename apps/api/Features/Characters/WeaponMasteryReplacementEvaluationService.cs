namespace CharacterForge.Api.Features.Characters;

public sealed record WeaponMasteryReplacementEvaluationRequest(
    Character Previous,
    Character Current,
    string? Trigger);

public sealed record WeaponMasteryReplacementEvaluation(
    ValidationResult Validation,
    CharacterDerivedValues? Derived);

public sealed class WeaponMasteryReplacementEvaluationService(CharacterEvaluationService characters)
{
    public async Task<WeaponMasteryReplacementEvaluation> EvaluateAsync(
        WeaponMasteryReplacementEvaluationRequest request,
        CancellationToken cancellationToken)
    {
        ArgumentNullException.ThrowIfNull(request);
        ArgumentNullException.ThrowIfNull(request.Previous);
        ArgumentNullException.ThrowIfNull(request.Current);

        var previousTask = characters.EvaluateAsync(request.Previous, cancellationToken);
        var currentTask = characters.EvaluateAsync(request.Current, cancellationToken);
        await Task.WhenAll(previousTask, currentTask);

        var previous = await previousTask;
        var current = await currentTask;
        var stateViolations = Prefix(previous.Validation.Violations, "previous")
            .Concat(Prefix(current.Validation.Violations, "current"))
            .ToArray();
        if (stateViolations.Length > 0)
        {
            return new WeaponMasteryReplacementEvaluation(
                new ValidationResult(stateViolations),
                null);
        }

        var transition = WeaponMasteryReplacementRules.Validate(
            request.Previous,
            request.Current,
            (previous.Derived?.WeaponMasteries?.Count ?? 0) > 0,
            request.Trigger);
        return transition.IsValid
            ? new WeaponMasteryReplacementEvaluation(transition, current.Derived)
            : new WeaponMasteryReplacementEvaluation(transition, null);
    }

    private static IEnumerable<RuleViolation> Prefix(
        IEnumerable<RuleViolation> violations,
        string state) => violations.Select(violation => violation with
        {
            Source = $"{state}.{violation.Source}"
        });
}

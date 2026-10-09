using CharacterForge.Api.Features.Progression;
using CharacterForge.Api.Infrastructure.Srd;

namespace CharacterForge.Api.Features.Characters;

public sealed record SpellReplacementEvaluationRequest(
    Character Previous,
    Character Current,
    string? Trigger);

public sealed record SpellReplacementEvaluation(
    ValidationResult Validation,
    CharacterDerivedValues? Derived);

public sealed class SpellReplacementEvaluationService(
    CharacterEvaluationService characters,
    ClassProgressionService classProgressions)
{
    public async Task<SpellReplacementEvaluation> EvaluateAsync(
        SpellReplacementEvaluationRequest request,
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
            return new SpellReplacementEvaluation(new ValidationResult(stateViolations), null);
        }

        var classId = request.Current.ClassProgressions![0].Class!.Id!;
        var progression = await classProgressions.GetAsync(classId, cancellationToken)
            ?? throw new SrdProviderException(
                "The current class did not provide a matching spellcasting progression.");
        var policy = progression.Spellcasting?.Policy;
        var rules = policy is null
            ? null
            : new SpellReplacementRulesContext(
                policy.CantripReplacement is null
                    ? null
                    : new SpellReplacementPolicyRule(
                        policy.CantripReplacement.Trigger,
                        policy.CantripReplacement.MaximumReplacements),
                new SpellReplacementPolicyRule(
                    policy.PreparedSpellReplacement.Trigger,
                    policy.PreparedSpellReplacement.MaximumReplacements));
        var transition = SpellReplacementRules.Validate(
            request.Previous,
            request.Current,
            rules,
            request.Trigger);

        return transition.IsValid
            ? new SpellReplacementEvaluation(transition, current.Derived)
            : new SpellReplacementEvaluation(transition, null);
    }

    private static IEnumerable<RuleViolation> Prefix(
        IEnumerable<RuleViolation> violations,
        string state) => violations.Select(violation => violation with
        {
            Source = $"{state}.{violation.Source}"
        });
}

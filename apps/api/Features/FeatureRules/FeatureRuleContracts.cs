namespace CharacterForge.Api.Features.FeatureRules;

public enum FeatureOptionSourceKind
{
    FeatType,
    ClassCantrips
}

public enum FeatureChoiceAvailability
{
    Supported,
    Locked
}

public enum FeatureRuleDependency
{
    Spellcasting
}

public sealed record FeatureOptionSource(
    FeatureOptionSourceKind Kind,
    string Filter,
    string? RequiredFeature = null);

public sealed record FeatureChoiceBranch(
    string Id,
    int SelectionCount,
    FeatureOptionSource OptionSource,
    FeatureChoiceAvailability Availability,
    FeatureRuleDependency? Dependency = null);

public sealed record FeatureRuleProvenance(
    string Document,
    string Section,
    int Page,
    string Url);

public sealed record FeatureChoiceRequirement(
    string Id,
    string ClassId,
    string? SubclassId,
    string FeatureId,
    int AvailableAtLevel,
    int Count,
    IReadOnlyList<FeatureChoiceBranch> Branches,
    FeatureRuleProvenance Provenance);

public sealed class FeatureRuleContentException(string message) : Exception(message);

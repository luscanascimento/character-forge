using CharacterForge.Api.Features.Characters;

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

public sealed record FeatureChoiceBranchDocument(
    string Id,
    int SelectionCount,
    string Availability,
    string? Dependency,
    IReadOnlyList<ContentReference> Options);

public sealed record FeatureChoiceRequirementDocument(
    string Id,
    string? SubclassId,
    string FeatureId,
    int AvailableAtLevel,
    int Count,
    IReadOnlyList<FeatureChoiceBranchDocument> Branches);

public sealed record FeatureChoiceDocument(
    string ManifestVersion,
    string Ruleset,
    string RulesVersion,
    ContentReference Class,
    IReadOnlyList<FeatureChoiceRequirementDocument> Requirements);

public sealed class FeatureRuleContentException(string message) : Exception(message);

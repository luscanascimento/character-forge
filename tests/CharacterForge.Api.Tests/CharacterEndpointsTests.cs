using System.Net;
using System.Net.Http.Json;
using CharacterForge.Api.Features.Catalog;
using CharacterForge.Api.Features.Characters;
using CharacterForge.Api.Infrastructure.Srd;
using CharacterForge.Api.Features.Progression;
using Microsoft.AspNetCore.Hosting;
using Microsoft.AspNetCore.Mvc.Testing;
using Microsoft.AspNetCore.TestHost;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.DependencyInjection.Extensions;

namespace CharacterForge.Api.Tests;

public sealed class CharacterEndpointsTests : IDisposable
{
    private readonly WebApplicationFactory<Program> _factory;
    private readonly HttpClient _client;

    public CharacterEndpointsTests()
    {
        _factory = new WebApplicationFactory<Program>().WithWebHostBuilder(builder =>
        {
            builder.ConfigureTestServices(services =>
            {
                services.RemoveAll<ISrdContentSource>();
                services.AddSingleton<ISrdContentSource, CharacterContentSource>();
            });
        });
        _client = _factory.CreateClient();
    }

    [Fact]
    public async Task Validate_ReturnsStructuredValidationAndDerivedValues()
    {
        var response = await _client.PostAsJsonAsync(
            "/api/characters/validate",
            CharacterValidatorTests.CreateValidCharacter() with
            {
                Spells = CharacterValidatorTests.WizardSpells(level: 1)
            },
            CancellationToken.None);
        var evaluation = await response.Content.ReadFromJsonAsync<CharacterEvaluation>(
            cancellationToken: CancellationToken.None);

        Assert.Equal(HttpStatusCode.OK, response.StatusCode);
        Assert.NotNull(evaluation);
        Assert.True(evaluation.Validation.IsValid);
        Assert.NotNull(evaluation.Derived);
        Assert.Equal(-1, evaluation.Derived.AbilityModifiers.Strength);
        Assert.Equal(2, evaluation.Derived.AbilityModifiers.Dexterity);
        Assert.Equal(2, evaluation.Derived.ProficiencyBonus);
        Assert.Equal(12, evaluation.Derived.ArmorClass);
        Assert.Equal(7, evaluation.Derived.HitPointMaximum);
        Assert.Equal(6, evaluation.Derived.HitDie);
        Assert.NotNull(evaluation.Derived.Spellcasting);
        Assert.Equal("int", evaluation.Derived.Spellcasting.Ability.Id);
        Assert.Equal([new SpellSlotAvailability(1, 2)], evaluation.Derived.Spellcasting.Slots);
        Assert.Equal(11, evaluation.Derived.Spellcasting.SpellSaveDc);
        Assert.Equal(3, evaluation.Derived.Spellcasting.SpellAttackModifier);
        Assert.Contains(
            evaluation.Derived.GrantedProficiencies,
            proficiency => proficiency.Proficiency.Id == "simple-weapons");
        Assert.Contains(
            evaluation.Derived.GrantedProficiencies,
            proficiency => proficiency.Proficiency.Id == "skill-insight");
        Assert.Contains(
            evaluation.Derived.GrantedProficiencies,
            proficiency => proficiency.Proficiency.Id == "skill-arcana");
        Assert.Contains(
            evaluation.Derived.GrantedProficiencies,
            proficiency => proficiency.Proficiency.Id == "skill-perception");
    }

    [Fact]
    public async Task Validate_DoesNotCalculateAnInvalidDraft()
    {
        var character = CharacterValidatorTests.CreateValidCharacter() with
        {
            RulesVersion = "SRD-5.1"
        };

        var response = await _client.PostAsJsonAsync(
            "/api/characters/validate",
            character,
            CancellationToken.None);
        var evaluation = await response.Content.ReadFromJsonAsync<CharacterEvaluation>(
            cancellationToken: CancellationToken.None);

        Assert.Equal(HttpStatusCode.OK, response.StatusCode);
        Assert.NotNull(evaluation);
        Assert.False(evaluation.Validation.IsValid);
        Assert.Null(evaluation.Derived);
        Assert.Contains(
            evaluation.Validation.Violations,
            violation => violation.Code == "character.rulesVersion.unsupported");
    }

    [Fact]
    public async Task Validate_ReportsMissingProficiencyChoicesWithoutDerivedValues()
    {
        var character = CharacterValidatorTests.CreateValidCharacter() with
        {
            ProficiencyChoices = []
        };

        var response = await _client.PostAsJsonAsync(
            "/api/characters/validate",
            character,
            CancellationToken.None);
        var evaluation = await response.Content.ReadFromJsonAsync<CharacterEvaluation>(
            cancellationToken: CancellationToken.None);

        Assert.Equal(HttpStatusCode.OK, response.StatusCode);
        Assert.NotNull(evaluation);
        Assert.False(evaluation.Validation.IsValid);
        Assert.Null(evaluation.Derived);
        Assert.Equal(
            2,
            evaluation.Validation.Violations.Count(
                violation => violation.Code == "character.proficiencyChoice.required"));
    }

    [Fact]
    public async Task Validate_ReportsCatalogReferenceThatNoLongerExists()
    {
        var character = CharacterValidatorTests.CreateValidCharacter() with
        {
            Species = new ContentReference("missing", "Missing species")
        };

        var response = await _client.PostAsJsonAsync(
            "/api/characters/validate",
            character,
            CancellationToken.None);
        var evaluation = await response.Content.ReadFromJsonAsync<CharacterEvaluation>(
            cancellationToken: CancellationToken.None);

        Assert.Equal(HttpStatusCode.OK, response.StatusCode);
        Assert.NotNull(evaluation);
        Assert.False(evaluation.Validation.IsValid);
        Assert.Null(evaluation.Derived);
        Assert.Contains(
            evaluation.Validation.Violations,
            violation => violation.Code == "character.species.notFound");
    }

    [Fact]
    public async Task Validate_ReturnsFixedHitPointsForAHigherLevelCharacter()
    {
        var response = await _client.PostAsJsonAsync(
            "/api/characters/validate",
            CharacterValidatorTests.CreateValidCharacter(level: 5) with
            {
                Spells = CharacterValidatorTests.WizardSpells(level: 5)
            },
            CancellationToken.None);
        var evaluation = await response.Content.ReadFromJsonAsync<CharacterEvaluation>(
            cancellationToken: CancellationToken.None);

        Assert.Equal(HttpStatusCode.OK, response.StatusCode);
        Assert.NotNull(evaluation?.Derived);
        Assert.Equal(3, evaluation.Derived.ProficiencyBonus);
        Assert.Equal(27, evaluation.Derived.HitPointMaximum);
        Assert.Equal(
            [new SpellSlotAvailability(1, 4), new SpellSlotAvailability(2, 3), new SpellSlotAvailability(3, 2)],
            evaluation.Derived.Spellcasting?.Slots);
    }

    [Fact]
    public async Task Validate_AcceptsCanonicalSelectionsFromTheClassSpellList()
    {
        var character = CharacterValidatorTests.CreateValidCharacter() with
        {
            ClassProgressions = [new ClassProgression(new ContentReference("bard", "Bard"), 1)],
            ProficiencyChoices =
            [
                new ProficiencyChoiceSelection(
                    "classes/bard/proficiencies/0",
                    [
                        new ContentReference("skill-arcana", "Skill: Arcana"),
                        new ContentReference("skill-history", "Skill: History"),
                        new ContentReference("skill-performance", "Skill: Performance")
                    ]),
                new ProficiencyChoiceSelection(
                    "species/elf/traits/keen-senses/proficiencies/0",
                    [new ContentReference("skill-perception", "Skill: Perception")])
            ],
            Spells = new SpellSelections(
                [
                    new ContentReference("dancing-lights", "Dancing Lights"),
                    new ContentReference("light", "Light")
                ],
                [
                    new ContentReference("charm-person", "Charm Person"),
                    new ContentReference("cure-wounds", "Cure Wounds"),
                    new ContentReference("detect-magic", "Detect Magic"),
                    new ContentReference("heroism", "Heroism")
                ])
        };

        var response = await _client.PostAsJsonAsync(
            "/api/characters/validate",
            character,
            CancellationToken.None);
        var evaluation = await response.Content.ReadFromJsonAsync<CharacterEvaluation>(
            cancellationToken: CancellationToken.None);

        Assert.Equal(HttpStatusCode.OK, response.StatusCode);
        Assert.NotNull(evaluation?.Derived);
        Assert.True(evaluation.Validation.IsValid);
        Assert.Equal(8, evaluation.Derived.HitDie);
        Assert.Equal("cha", evaluation.Derived.Spellcasting?.Ability.Id);
    }

    [Fact]
    public async Task ValidateSpellReplacement_AcceptsOneReplacementWhenAClassLevelIsGained()
    {
        var request = new SpellReplacementEvaluationRequest(
            BardCharacter(
                1,
                [("dancing-lights", "Dancing Lights"), ("light", "Light")],
                [
                    ("charm-person", "Charm Person"),
                    ("cure-wounds", "Cure Wounds"),
                    ("detect-magic", "Detect Magic"),
                    ("heroism", "Heroism")
                ]),
            BardCharacter(
                2,
                [("light", "Light"), ("mage-hand", "Mage Hand")],
                [
                    ("cure-wounds", "Cure Wounds"),
                    ("detect-magic", "Detect Magic"),
                    ("heroism", "Heroism"),
                    ("command", "Command")
                ]),
            SpellReplacementRules.ClassLevelGained);

        var response = await _client.PostAsJsonAsync(
            "/api/characters/validate-spell-replacement",
            request,
            CancellationToken.None);
        var evaluation = await response.Content.ReadFromJsonAsync<SpellReplacementEvaluation>(
            cancellationToken: CancellationToken.None);

        Assert.Equal(HttpStatusCode.OK, response.StatusCode);
        Assert.NotNull(evaluation?.Derived);
        Assert.True(evaluation.Validation.IsValid);
    }

    [Fact]
    public async Task ValidateSpellReplacement_RejectsMoreThanTheClassLevelLimit()
    {
        var request = new SpellReplacementEvaluationRequest(
            BardCharacter(
                1,
                [("dancing-lights", "Dancing Lights"), ("light", "Light")],
                [
                    ("charm-person", "Charm Person"),
                    ("cure-wounds", "Cure Wounds"),
                    ("detect-magic", "Detect Magic"),
                    ("heroism", "Heroism")
                ]),
            BardCharacter(
                2,
                [("mage-hand", "Mage Hand"), ("prestidigitation", "Prestidigitation")],
                [
                    ("detect-magic", "Detect Magic"),
                    ("heroism", "Heroism"),
                    ("command", "Command"),
                    ("dissonant-whispers", "Dissonant Whispers")
                ]),
            SpellReplacementRules.ClassLevelGained);

        var response = await _client.PostAsJsonAsync(
            "/api/characters/validate-spell-replacement",
            request,
            CancellationToken.None);
        var evaluation = await response.Content.ReadFromJsonAsync<SpellReplacementEvaluation>(
            cancellationToken: CancellationToken.None);

        Assert.Equal(HttpStatusCode.OK, response.StatusCode);
        Assert.NotNull(evaluation);
        Assert.Null(evaluation.Derived);
        Assert.Contains(evaluation.Validation.Violations, violation =>
            violation.Code == "character.spellReplacement.cantrips.limit");
        Assert.Contains(evaluation.Validation.Violations, violation =>
            violation.Code == "character.spellReplacement.preparedSpells.limit");
    }

    [Fact]
    public async Task Validate_RetainsButInvalidatesSubclassAfterLevelDecrease()
    {
        var character = CharacterValidatorTests.CreateValidCharacter(level: 5) with
        {
            ClassProgressions =
            [
                new ClassProgression(
                    new ContentReference("wizard", "Wizard"),
                    2,
                    new ContentReference("evoker", "Evoker"))
            ]
        };

        var response = await _client.PostAsJsonAsync(
            "/api/characters/validate",
            character,
            CancellationToken.None);
        var evaluation = await response.Content.ReadFromJsonAsync<CharacterEvaluation>(
            cancellationToken: CancellationToken.None);

        Assert.Equal(HttpStatusCode.OK, response.StatusCode);
        Assert.NotNull(evaluation);
        Assert.False(evaluation.Validation.IsValid);
        Assert.Null(evaluation.Derived);
        Assert.Contains(
            evaluation.Validation.Violations,
            violation => violation.Code == "character.subclass.unavailableAtLevel");
        Assert.Equal("evoker", character.ClassProgressions[0].Subclass?.Id);
    }

    [Fact]
    public async Task Validate_ReturnsServiceUnavailableWhenRuleContentProviderFails()
    {
        var character = CharacterValidatorTests.CreateValidCharacter() with
        {
            Species = new ContentReference("provider-failure", "Unavailable species")
        };

        var response = await _client.PostAsJsonAsync(
            "/api/characters/validate",
            character,
            CancellationToken.None);

        Assert.Equal(HttpStatusCode.ServiceUnavailable, response.StatusCode);
        Assert.Equal("application/problem+json", response.Content.Headers.ContentType?.MediaType);
    }

    [Fact]
    public async Task EvaluateFeat_SeparatesMetPrerequisitesFromUnsupportedEffects()
    {
        var request = new FeatEligibilityRequest(
            CharacterValidatorTests.CreateValidCharacter(level: 4) with
            {
                Spells = CharacterValidatorTests.WizardSpells(level: 4)
            },
            "grappler");

        var response = await _client.PostAsJsonAsync(
            "/api/characters/evaluate-feat",
            request,
            CancellationToken.None);
        var evaluation = await response.Content.ReadFromJsonAsync<FeatEligibilityEvaluation>(
            cancellationToken: CancellationToken.None);

        Assert.Equal(HttpStatusCode.OK, response.StatusCode);
        Assert.NotNull(evaluation?.Feat);
        Assert.True(evaluation.Validation.IsValid);
        Assert.True(evaluation.Feat.MeetsPrerequisites);
        Assert.False(evaluation.Feat.EffectsSupported);
        Assert.False(evaluation.Feat.CanSelect);
        Assert.Equal("grappler", evaluation.Feat.Feat.Id);
    }

    [Fact]
    public async Task EvaluateFeat_ValidatesAndReturnsTypedAbilityScoreImprovementEffects()
    {
        var request = new FeatEligibilityRequest(
            CharacterValidatorTests.CreateValidCharacter(level: 4) with
            {
                Spells = CharacterValidatorTests.WizardSpells(level: 4)
            },
            "ability-score-improvement",
            new AbilityScoreImprovementEffect([new("int", 1), new("wis", 1)]));

        var response = await _client.PostAsJsonAsync(
            "/api/characters/evaluate-feat",
            request,
            CancellationToken.None);
        var evaluation = await response.Content.ReadFromJsonAsync<FeatEligibilityEvaluation>(
            cancellationToken: CancellationToken.None);

        Assert.Equal(HttpStatusCode.OK, response.StatusCode);
        Assert.NotNull(evaluation?.Feat);
        Assert.True(evaluation.Validation.IsValid);
        Assert.True(evaluation.Feat.MeetsPrerequisites);
        Assert.True(evaluation.Feat.EffectsSupported);
        Assert.True(evaluation.Feat.CanSelect);
        Assert.Equal(13, evaluation.Feat.ResultingAbilities?.Intelligence);
        Assert.Equal(11, evaluation.Feat.ResultingAbilities?.Wisdom);
        Assert.Equal(FeatEffectManifest.Version, evaluation.Feat.EffectManifestVersion);
    }

    [Fact]
    public async Task EvaluateFeat_RequiresAChoiceForTheSupportedAbilityScoreImprovementEffect()
    {
        var request = new FeatEligibilityRequest(
            CharacterValidatorTests.CreateValidCharacter(level: 4) with
            {
                Spells = CharacterValidatorTests.WizardSpells(level: 4)
            },
            "ability-score-improvement");

        var response = await _client.PostAsJsonAsync(
            "/api/characters/evaluate-feat",
            request,
            CancellationToken.None);
        var evaluation = await response.Content.ReadFromJsonAsync<FeatEligibilityEvaluation>(
            cancellationToken: CancellationToken.None);

        Assert.Equal(HttpStatusCode.OK, response.StatusCode);
        Assert.NotNull(evaluation?.Feat);
        Assert.False(evaluation.Validation.IsValid);
        Assert.True(evaluation.Feat.MeetsPrerequisites);
        Assert.True(evaluation.Feat.EffectsSupported);
        Assert.False(evaluation.Feat.CanSelect);
        Assert.Null(evaluation.Feat.ResultingAbilities);
        Assert.Contains(evaluation.Validation.Violations, violation =>
            violation.Code == "character.feat.effect.required");
    }

    [Fact]
    public async Task Validate_ResolvesEquippedArmorAndReturnsCanonicalArmorClass()
    {
        var character = CharacterValidatorTests.CreateValidCharacter() with
        {
            Spells = CharacterValidatorTests.WizardSpells(level: 1),
            Equipment = new EquipmentSelections([
                new EquipmentItemSelection(
                    new ContentReference("leather-armor", "Leather Armor"),
                    1,
                    Equipped: true)
            ])
        };

        var response = await _client.PostAsJsonAsync(
            "/api/characters/validate",
            character,
            CancellationToken.None);
        var evaluation = await response.Content.ReadFromJsonAsync<CharacterEvaluation>(
            cancellationToken: CancellationToken.None);

        Assert.Equal(HttpStatusCode.OK, response.StatusCode);
        Assert.NotNull(evaluation?.Derived);
        Assert.True(evaluation.Validation.IsValid);
        Assert.Equal(13, evaluation.Derived.ArmorClass);
    }

    public void Dispose()
    {
        _client.Dispose();
        _factory.Dispose();
    }

    private static Character BardCharacter(
        int level,
        IReadOnlyList<(string Id, string Name)> cantrips,
        IReadOnlyList<(string Id, string Name)> preparedSpells) =>
        CharacterValidatorTests.CreateValidCharacter() with
        {
            ClassProgressions = [new ClassProgression(new ContentReference("bard", "Bard"), level)],
            ProficiencyChoices =
            [
                new ProficiencyChoiceSelection(
                    "classes/bard/proficiencies/0",
                    [
                        new ContentReference("skill-arcana", "Skill: Arcana"),
                        new ContentReference("skill-history", "Skill: History"),
                        new ContentReference("skill-performance", "Skill: Performance")
                    ]),
                new ProficiencyChoiceSelection(
                    "species/elf/traits/keen-senses/proficiencies/0",
                    [new ContentReference("skill-perception", "Skill: Perception")])
            ],
            FeatureChoices = level >= 2
                ?
                [
                    new FeatureChoiceSelection(
                        "bard-expertise-2",
                        "expertise-skills",
                        [
                            new ContentReference("skill-arcana", "Skill: Arcana"),
                            new ContentReference("skill-history", "Skill: History")
                        ])
                ]
                : [],
            Spells = new SpellSelections(
                cantrips.Select(spell => new ContentReference(spell.Id, spell.Name)).ToArray(),
                preparedSpells.Select(spell => new ContentReference(spell.Id, spell.Name)).ToArray())
        };

    private sealed class CharacterContentSource : ISrdContentSource
    {
        public Task<IReadOnlyList<CatalogItemSummary>> GetItemsAsync(
            CatalogCategory category,
            int? level,
            string? school,
            string? characterClass,
            CancellationToken cancellationToken) => category == CatalogCategory.Spells
                ? Task.FromResult<IReadOnlyList<CatalogItemSummary>>(characterClass == "bard"
                    ?
                    [
                    new("dancing-lights", "Dancing Lights", "spells", 0),
                    new("light", "Light", "spells", 0),
                    new("mage-hand", "Mage Hand", "spells", 0),
                    new("prestidigitation", "Prestidigitation", "spells", 0),
                    new("charm-person", "Charm Person", "spells", 1),
                    new("command", "Command", "spells", 1),
                    new("cure-wounds", "Cure Wounds", "spells", 1),
                    new("detect-magic", "Detect Magic", "spells", 1),
                    new("dissonant-whispers", "Dissonant Whispers", "spells", 1),
                    new("heroism", "Heroism", "spells", 1),
                    new("shatter", "Shatter", "spells", 2)
                    ]
                    : characterClass == "wizard"
                        ? Enumerable.Range(1, 4)
                            .Select(index => new CatalogItemSummary(
                                $"wizard-cantrip-{index}",
                                $"Wizard Cantrip {index}",
                                "spells",
                                0))
                            .Concat(Enumerable.Range(1, 44).Select(index => new CatalogItemSummary(
                                $"wizard-spell-{index}",
                                $"Wizard Spell {index}",
                                "spells",
                                1)))
                            .ToArray()
                        : [])
                : throw new NotSupportedException();

        public Task<CatalogItemDetail?> GetItemAsync(
            CatalogCategory category,
            string id,
            CancellationToken cancellationToken)
        {
            if (id == "provider-failure")
            {
                throw new SrdProviderException("Unavailable in test.");
            }

            if (id == "missing")
            {
                return Task.FromResult<CatalogItemDetail?>(null);
            }

            if (category == CatalogCategory.Feats)
            {
                var abilityScoreImprovement = id == "ability-score-improvement";
                return Task.FromResult<CatalogItemDetail?>(new CatalogItemDetail(
                    id,
                    abilityScoreImprovement
                        ? "Ability Score Improvement"
                        : id == "grappler" ? "Grappler" : id,
                    CatalogCategory.Feats.ToSlug(),
                    [],
                    [],
                    [],
                    Feat: new CatalogFeatFacts(
                        "general",
                        MinimumLevel: 4,
                        RequiredFeature: null,
                        IsRepeatable: abilityScoreImprovement,
                        abilityScoreImprovement
                            ? null
                            : new CatalogAbilityScorePrerequisiteChoice(
                                1,
                                [
                                    new CatalogAbilityScorePrerequisite(
                                        new CatalogReference("str", "STR"),
                                        13),
                                    new CatalogAbilityScorePrerequisite(
                                        new CatalogReference("dex", "DEX"),
                                        13)
                                ]))));
            }

            if (category == CatalogCategory.Equipment)
            {
                return Task.FromResult<CatalogItemDetail?>(new CatalogItemDetail(
                    id,
                    id == "leather-armor" ? "Leather Armor" : id,
                    CatalogCategory.Equipment.ToSlug(),
                    [],
                    [],
                    [],
                    Equipment: new CatalogEquipmentFacts(
                        [
                            new CatalogReference("armor", "Armor"),
                            new CatalogReference("light-armor", "Light Armor")
                        ],
                        Cost: null,
                        Weight: 10,
                        Weapon: null,
                        new CatalogArmorFacts(
                            BaseArmorClass: 11,
                            AddsDexterity: true,
                            MaximumDexterityBonus: null,
                            StrengthMinimum: 0,
                            ImposesStealthDisadvantage: false))));
            }

            var facts = category switch
            {
                CatalogCategory.Classes => new CatalogCharacterCreationFacts(
                    id == "bard" ? 8 : 6,
                    [
                        new CatalogProficiencyReference("simple-weapons", "Simple Weapons", false),
                        new CatalogProficiencyReference("light-armor", "Light Armor", false),
                        new CatalogProficiencyReference("saving-throw-int", "Saving Throw: INT", false)
                    ],
                    [
                        id == "bard"
                            ? new CatalogProficiencyChoice(
                                "classes/bard/proficiencies/0",
                                "Choose three Bard skills",
                                3,
                                [
                                    new CatalogProficiencyReference("skill-arcana", "Skill: Arcana", true),
                                    new CatalogProficiencyReference("skill-history", "Skill: History", true),
                                    new CatalogProficiencyReference("skill-performance", "Skill: Performance", true)
                                ])
                            : new CatalogProficiencyChoice(
                                "classes/wizard/proficiencies/0",
                                "Choose two Wizard skills",
                                2,
                                [
                                    new CatalogProficiencyReference("skill-arcana", "Skill: Arcana", true),
                                    new CatalogProficiencyReference("skill-history", "Skill: History", true),
                                    new CatalogProficiencyReference("skill-insight", "Skill: Insight", true)
                                ])
                    ]),
                CatalogCategory.Backgrounds => new CatalogCharacterCreationFacts(
                    null,
                    [
                        new CatalogProficiencyReference("skill-insight", "Skill: Insight", true),
                        new CatalogProficiencyReference("skill-religion", "Skill: Religion", true)
                    ],
                    []),
                CatalogCategory.Species => new CatalogCharacterCreationFacts(
                    null,
                    [],
                    [
                        new CatalogProficiencyChoice(
                            "species/elf/traits/keen-senses/proficiencies/0",
                            "Choose one Keen Senses skill",
                            1,
                            [
                                new CatalogProficiencyReference("skill-insight", "Skill: Insight", true),
                                new CatalogProficiencyReference("skill-perception", "Skill: Perception", true),
                                new CatalogProficiencyReference("skill-survival", "Skill: Survival", true)
                            ])
                    ]),
                _ => throw new ArgumentOutOfRangeException(nameof(category), category, null)
            };

            return Task.FromResult<CatalogItemDetail?>(new CatalogItemDetail(
                id,
                category switch
                {
                    CatalogCategory.Classes => id == "bard" ? "Bard" : "Wizard",
                    CatalogCategory.Species => "Elf",
                    CatalogCategory.Backgrounds => "Acolyte",
                    _ => id
                },
                category.ToSlug(),
                [],
                [],
                [],
                CharacterCreation: facts));
        }

        public Task<ClassProgressionDocument?> GetClassProgressionAsync(
            string classId,
            CancellationToken cancellationToken) => Task.FromResult<ClassProgressionDocument?>(
                classId == "missing"
                    ? null
                    : new ClassProgressionDocument(
                        new CatalogReference(classId, classId == "bard" ? "Bard" : "Wizard"),
                        classId == "bard" ? 8 : 6,
                        Enumerable.Range(1, 20)
                            .Select(level => new ClassLevelProgression(
                                level,
                                ProficiencyRules.GetBonus(level),
                                classId == "bard" && level is 2 or 9
                                    ? [new CatalogReference("bard-expertise", "Expertise")]
                                    : []))
                            .ToArray(),
                        [
                            new SubclassProgression(
                                new CatalogReference(
                                    classId == "bard" ? "lore" : "evoker",
                                    classId == "bard" ? "College of Lore" : "Evoker"),
                                3,
                                [
                                    new SubclassLevelProgression(
                                        3,
                                        [new CatalogReference("sculpt-spells", "Sculpt Spells")])
                                ])
                        ],
                        Spellcasting: new ClassSpellcastingProgression(
                            1,
                            new CatalogReference(
                                classId == "bard" ? "cha" : "int",
                                classId == "bard" ? "CHA" : "INT"),
                            Enumerable.Range(1, 20)
                                .Select(level => new ClassSpellcastingLevel(
                                    level,
                                    classId == "bard" ? 2 : level < 4 ? 3 : 4,
                                    classId == "bard" ? 4 : Math.Min(level + 3, 22),
                                    SpellSlots(level)))
                                .ToArray())));

        private static IReadOnlyList<SpellSlotCapacity> SpellSlots(int level) => level switch
        {
            1 => [new SpellSlotCapacity(1, 2)],
            2 => [new SpellSlotCapacity(1, 3)],
            3 or 4 => [new SpellSlotCapacity(1, 4), new SpellSlotCapacity(2, level == 3 ? 2 : 3)],
            _ => [
                new SpellSlotCapacity(1, 4),
                new SpellSlotCapacity(2, 3),
                new SpellSlotCapacity(3, 2)
            ]
        };
    }
}

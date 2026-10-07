using JiuJitsu.Api.Models;

namespace JiuJitsu.Api.Services;

/// <summary>
/// Single place for the Adult/Child belt systems and degree limits.
/// </summary>
public static class BeltRules
{
    public static readonly string[] ChildBeltNames =
    [
        "Branca",
        "Cinza/Branca",
        "Cinza",
        "Cinza/Preta",
        "Amarela/Branca",
        "Amarela",
        "Amarela/Preta",
        "Laranja/Branca",
        "Laranja",
        "Laranja/Preta",
        "Verde/Branca",
        "Verde",
        "Verde/Preta"
    ];

    public static readonly string[] AdultBeltNames =
    [
        "Branca",
        "Azul",
        "Roxa",
        "Marrom",
        "Preta"
    ];

    public static BeltCategory CategoryFor(StudentType studentType) =>
        studentType == StudentType.Adult ? BeltCategory.Adult : BeltCategory.Child;

    /// <summary>Black belt goes up to 6 degrees; every other belt up to 4.</summary>
    public static int MaxDegree(Belt belt) =>
        belt.Category == BeltCategory.Adult && belt.Order == AdultBeltNames.Length ? 6 : 4;

    public static void EnsureValid(StudentType studentType, Belt belt, int degree)
    {
        if (CategoryFor(studentType) != belt.Category)
        {
            throw new DomainException(studentType == StudentType.Adult
                ? "Aluno adulto não pode receber faixa infantil."
                : "Aluno infantil não pode receber faixa adulta.");
        }

        var max = MaxDegree(belt);
        if (degree < 0 || degree > max)
            throw new DomainException($"Grau da faixa {belt.Name} deve estar entre 0 e {max}.");
    }
}

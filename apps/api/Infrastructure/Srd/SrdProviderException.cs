namespace CharacterForge.Api.Infrastructure.Srd;

public sealed class SrdProviderException(string message, Exception? innerException = null)
    : Exception(message, innerException);

namespace JiuJitsu.Api.Services;

/// <summary>Business rule violation. Returned to the client as 400 with the message.</summary>
public class DomainException(string message) : Exception(message);

/// <summary>Returned to the client as 404 with the message.</summary>
public class NotFoundException(string message) : Exception(message);

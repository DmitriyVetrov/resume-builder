using System.Security.Cryptography;
using System.Text;
using System.Text.Json;
using ResumeBuilder.Application.Resumes;
using Xunit;

namespace ResumeBuilder.Api.Tests;

/// <summary>RFC 8785 and the contract's `Idempotency-Key` request hash (I05).</summary>
public sealed class P07CanonicalJsonTests
{
  private static string Canonical(string json)
  {
    using var document = JsonDocument.Parse(json);
    return Encoding.UTF8.GetString(CanonicalJson.Serialize(document.RootElement));
  }

  [Theory]
  [InlineData("{\"b\":1,\"a\":2}", "{\"a\":2,\"b\":1}")]
  [InlineData("{ \"a\" : [ 1 , 2 ] }", "{\"a\":[1,2]}")]
  [InlineData("[4.50,2e-3,1e30,1E-7,0.000001,-0,100]", "[4.5,0.002,1e+30,1e-7,0.000001,0,100]")]
  [InlineData("[1e20,1e21,333333333.33333329]", "[100000000000000000000,1e+21,333333333.3333333]")]
  [InlineData("\"\\u0041\\u00e9\\n\\u0001\\\"/\"", "\"A\u00e9\\n\\u0001\\\"/\"")]
  [InlineData("{\"\\u20ac\":1,\"\\ud83d\\ude00\":2,\"\\ufb33\":3,\"\\r\":4,\"1\":5}", "{\"\\r\":4,\"1\":5,\"\u20ac\":1,\"\U0001F600\":2,\"\ufb33\":3}")]
  public void I05Rfc8785Vectors(string input, string expected) => Assert.Equal(expected, Canonical(input));

  [Fact]
  public void I05KeyOrderAndWhitespaceDoNotChangeTheRequestHash()
  {
    using var first = JsonDocument.Parse("{\"title\":\"x\",\"n\":1.0}");
    using var second = JsonDocument.Parse(" { \"n\" : 1 , \"title\" : \"x\" } ");
    var hash = RequestHash.Compute("PUT", "/api/v1/resumes/a/document", CanonicalJson.Serialize(first.RootElement));
    Assert.Equal(hash, RequestHash.Compute("PUT", "/api/v1/resumes/a/document", CanonicalJson.Serialize(second.RootElement)));
    Assert.NotEqual(hash, RequestHash.Compute("PUT", "/api/v1/resumes/b/document", CanonicalJson.Serialize(first.RootElement)));
    Assert.NotEqual(hash, RequestHash.Compute("POST", "/api/v1/resumes/a/document", CanonicalJson.Serialize(first.RootElement)));
  }

  [Fact]
  public void I05HashIsSha256OfMethodPathNewlineAndBodyInput()
  {
    var expected = Convert.ToHexStringLower(SHA256.HashData(Encoding.UTF8.GetBytes("DELETE /api/v1/resumes/a\n")));
    Assert.Equal(expected, RequestHash.Compute("DELETE", "/api/v1/resumes/a", []));
    byte[] body = [0xFF, 0x00, 0xD8];
    var withBody = Convert.ToHexStringLower(SHA256.HashData([.. Encoding.UTF8.GetBytes("POST /p\n"), .. body]));
    Assert.Equal(withBody, RequestHash.Compute("POST", "/p", body));
  }
}

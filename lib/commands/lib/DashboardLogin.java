import java.io.BufferedReader;
import java.io.DataOutputStream;
import java.io.InputStreamReader;
import java.net.Authenticator;
import java.net.HttpURLConnection;
import java.net.InetSocketAddress;
import java.net.PasswordAuthentication;
import java.net.Proxy;
import java.net.URI;
import java.net.URLEncoder;
import java.text.MessageFormat;
import java.util.HashMap;
import java.util.Iterator;
import java.util.Map;
import java.util.Map.Entry;

public class DashboardLogin
{
	private static final String DASHBOARD_URL = "https://dashboard.appcelerator.com/api/v1/auth/login";
	private static final String PROXY_USER_NAME = "{0}.proxyUserName";
	private static final String PROXY_USER = "{0}.proxyUser";
	private static final String PROXY_PASSWORD = "{0}.proxyPassword";
	private static final String PROXY_HOST = "{0}.proxyHost";
	private static final String PROXY_PORT = "{0}.proxyPort";

	private static String[] PROTOCOLS = new String[] { "https", "http" };

	public static void main(String[] args) throws Exception
	{
		String proxyHost = null;
		int proxyPort = 0;
		for (String protocol : PROTOCOLS)
		{
			proxyHost = System.getProperty(MessageFormat.format(PROXY_HOST, protocol));
			String port = System.getProperty(MessageFormat.format(PROXY_PORT, protocol), "0");
			try
			{
				proxyPort = Integer.parseInt(port);
			}
			catch (NumberFormatException e)
			{
			}

			String userName = System.getProperty(MessageFormat.format(PROXY_USER, protocol));
			if (userName == null)
			{
				userName = System.getProperty(MessageFormat.format(PROXY_USER_NAME, protocol));
			}
			String password = System.getProperty(MessageFormat.format(PROXY_PASSWORD, protocol));
			if (userName != null && password != null)
			{
				Authenticator.setDefault(new DashboardLogin.SimpleProxyAuthenticator(userName, password));
			}

			if (proxyHost != null && proxyHost.length() > 0)
			{
				break;
			}
		}
		URI dashboardUri = new URI(DASHBOARD_URL);
		Proxy proxy = Proxy.NO_PROXY;
		if (proxyHost != null && proxyHost.length() > 0)
		{
			proxy = new Proxy(Proxy.Type.HTTP, new InetSocketAddress(proxyHost, proxyPort));
		}
		HttpURLConnection httpURLConnection = (HttpURLConnection) dashboardUri.toURL().openConnection(proxy);
		httpURLConnection.setRequestMethod("POST");
		httpURLConnection.setDoInput(true);
		httpURLConnection.setDoOutput(true);
		httpURLConnection.setConnectTimeout(5000);
		httpURLConnection.setReadTimeout(10000);

		DataOutputStream outputStream = new DataOutputStream(httpURLConnection.getOutputStream());
		StringBuilder paramsString = new StringBuilder();

		Map<String, String> params = new HashMap<String, String>(3);
		params.put("username", "random@appcelerator.com");
		params.put("password", "password");
		params.put("from", "studio");
		Iterator<Entry<String, String>> iterator = params.entrySet().iterator();
		while (iterator.hasNext())
		{
			Entry<String, String> next = iterator.next();
			paramsString.append(URLEncoder.encode(next.getKey(), "UTF-8"));
			paramsString.append('=');
			paramsString.append(URLEncoder.encode(next.getValue(), "UTF-8"));
			paramsString.append('&');
		}
		paramsString.deleteCharAt(paramsString.length() - 1);
		outputStream.writeBytes(paramsString.toString());
		outputStream.flush();

		int responseCode = httpURLConnection.getResponseCode();
		System.out.println(new StringBuilder().append("HTTP Response code: ").append(responseCode).toString());
		String response;
		BufferedReader reader;
		if (responseCode == 200)
		{
			reader = new BufferedReader(new InputStreamReader(httpURLConnection.getInputStream()));
		}
		else
		{
			reader = new BufferedReader(new InputStreamReader(httpURLConnection.getErrorStream()));
		}
		while ((response = reader.readLine()) != null)
		{
			System.out.println(response);
		}

		// If we don't get 200 or 400 response from the server, then indicate a problem with the connection by non-zero
		// exit code.
		if (responseCode != 200 && responseCode != 400)
		{
			System.exit(1);
		}
	}

	static class SimpleProxyAuthenticator extends Authenticator
	{
		private final String username;
		private final String password;

		public SimpleProxyAuthenticator(String paramString1, String paramString2)
		{
			this.username = paramString1;
			this.password = paramString2;
		}

		@Override
		protected PasswordAuthentication getPasswordAuthentication()
		{
			return new PasswordAuthentication(this.username, this.password.toCharArray());
		}
	}
}
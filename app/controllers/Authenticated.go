package controllers

import "github.com/revel/revel"

type Authenticated struct {
	*revel.Controller
}

func (c Authenticated) Index(token string) revel.Result {
	var didUser DidUser
	didUser.FirstName = c.Session["firstName"]
	didUser.LastName = c.Session["lastName"]
	didUser.EmailAddress = c.Session["email"]
	didUser.PublicKey = c.Session["publicKey"]
	didUser.Id = c.Session["id"]

	return c.Render(didUser)
}

func IsUserAuthenticated(c *revel.Controller) revel.Result {
	if c.Session["id"] == "" {
		c.Flash.Error("Please log in first")
		return c.Redirect(App.Index)
	}
	return nil
}
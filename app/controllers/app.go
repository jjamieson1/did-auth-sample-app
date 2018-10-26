package controllers

import (
	"crypto/tls"
	"encoding/json"
	"github.com/go-resty/resty"
	"github.com/revel/revel"
	"log"
)

type App struct {
	*revel.Controller
}

type DidUser struct {
	 Id 	string `json:"id"`
	 FirstName	string	`json:"firstName"`
	 LastName	string	`json:"lastName"`
	 EmailAddress	string	`json:"emailAddress"`
	 PublicKey 		string 	`json:"publicKey"`
}

func (c App) Index() revel.Result {
	return c.Render()
}

func (c App) ProcessDidAuth(token string) revel.Result {

	var didUser DidUser
	///did-auth/challenge/{nonce}/user
	url := "did-auth/challenge/" + token + "/user"

	resty.SetTLSClientConfig(&tls.Config{InsecureSkipVerify: true})
	resp, err := resty.R().
		SetHeader("Accept", "application/json").
		SetHeader("Authorization", "").
		Get(url)
	if err != nil {
		log.Printf("Error with the nonce.")
		c.Flash.Error("Error validating the reponse, error: %v", err.Error())
	}
	err = json.Unmarshal(resp.Body(), &didUser)
	if err != nil {
		log.Printf("Error getting a response from the nonce. error: %v", err.Error())
	}

	c.Session["firstName"] = didUser.FirstName
	c.Session["lastName"] = didUser.LastName
	c.Session["email"] = didUser.EmailAddress
	c.Session["publicKey"] = didUser.PublicKey
	c.Session["id"] = didUser.Id

	return c.Redirect(Authenticated.Index)
}